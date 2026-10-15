#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <shellapi.h>
#include <shlobj.h>
#include <shobjidl.h>
#include <WebView2.h>
#include <atomic>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <memory>
#include <string>
#include <vector>
#include "LocalServer.hpp"

namespace fs = std::filesystem;
constexpr UINT chooseDataCommand = 101, useDemoCommand = 102, reloadCommand = 103, quitCommand = 104;
constexpr UINT downloadMessage = WM_APP + 1;
constexpr wchar_t preferenceKey[] = L"Software\\LastBlade2FrameLab";

template<class Interface, const IID* Id> class Callback : public Interface {
    std::atomic<ULONG> references{1};
public:
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid, void** out) override {
        if (!out) return E_POINTER;
        *out = nullptr;
        if (IsEqualIID(iid, IID_IUnknown) || IsEqualIID(iid, *Id)) { *out = static_cast<Interface*>(this); AddRef(); return S_OK; }
        return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++references; }
    ULONG STDMETHODCALLTYPE Release() override { auto count = --references; if (!count) delete this; return count; }
protected:
    virtual ~Callback() = default;
};

std::wstring wide(const std::string& value) {
    if (value.empty()) return {};
    int count = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0);
    if (!count) throw std::runtime_error("Invalid UTF-8 text.");
    std::wstring result(count, L'\0');
    MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), result.data(), count);
    return result;
}
fs::path executableFolder() {
    std::vector<wchar_t> text(32768);
    auto count = GetModuleFileNameW(nullptr, text.data(), static_cast<DWORD>(text.size()));
    if (!count || count >= text.size()) throw std::runtime_error("Executable path could not be read.");
    return fs::path(std::wstring(text.data(), count)).parent_path();
}
bool validPack(const fs::path& folder) {
    if (folder.empty()) return false;
    for (const auto* file : {L"manifest.json", L"extended/index.json", L"extended/metrics.json", L"extended/profiles.json"}) {
        std::error_code error;
        if (!fs::is_regular_file(folder / file, error) || error) return false;
    }
    return true;
}
std::wstring preferencePath() {
    DWORD bytes = 0;
    if (RegGetValueW(HKEY_CURRENT_USER, preferenceKey, L"DataDirectory", RRF_RT_REG_SZ, nullptr, nullptr, &bytes) != ERROR_SUCCESS || bytes > 65536) return {};
    std::vector<wchar_t> text(bytes / sizeof(wchar_t) + 1);
    if (RegGetValueW(HKEY_CURRENT_USER, preferenceKey, L"DataDirectory", RRF_RT_REG_SZ, nullptr, text.data(), &bytes) != ERROR_SUCCESS) return {};
    return text.data();
}
bool preferenceDemo() {
    DWORD value = 0, bytes = sizeof(value);
    return RegGetValueW(HKEY_CURRENT_USER, preferenceKey, L"UseDemo", RRF_RT_REG_DWORD, nullptr, &value, &bytes) == ERROR_SUCCESS && value;
}
void remember(const fs::path& folder) {
    HKEY key = nullptr;
    if (RegCreateKeyExW(HKEY_CURRENT_USER, preferenceKey, 0, nullptr, 0, KEY_SET_VALUE, nullptr, &key, nullptr) != ERROR_SUCCESS) return;
    DWORD demo = folder.empty() ? 1 : 0;
    RegSetValueExW(key, L"UseDemo", 0, REG_DWORD, reinterpret_cast<const BYTE*>(&demo), sizeof(demo));
    if (folder.empty()) RegDeleteValueW(key, L"DataDirectory");
    else { auto text = folder.wstring(); RegSetValueExW(key, L"DataDirectory", 0, REG_SZ, reinterpret_cast<const BYTE*>(text.c_str()), static_cast<DWORD>((text.size() + 1) * sizeof(wchar_t))); }
    RegCloseKey(key);
}
void openExternal(const std::wstring& uri) {
    if (uri.rfind(L"https://", 0) == 0 || uri.rfind(L"http://", 0) == 0) ShellExecuteW(nullptr, L"open", uri.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
}

struct Application;
struct EnvironmentHandler final : Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler, &IID_ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler> {
    Application* app;
    explicit EnvironmentHandler(Application* value) : app(value) {}
    HRESULT STDMETHODCALLTYPE Invoke(HRESULT error, ICoreWebView2Environment* environment) override;
};
struct ControllerHandler final : Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler, &IID_ICoreWebView2CreateCoreWebView2ControllerCompletedHandler> {
    Application* app;
    explicit ControllerHandler(Application* value) : app(value) {}
    HRESULT STDMETHODCALLTYPE Invoke(HRESULT error, ICoreWebView2Controller* controller) override;
};
struct NavigationHandler final : Callback<ICoreWebView2NavigationStartingEventHandler, &IID_ICoreWebView2NavigationStartingEventHandler> {
    std::wstring origin;
    explicit NavigationHandler(std::wstring value) : origin(std::move(value)) {}
    HRESULT STDMETHODCALLTYPE Invoke(ICoreWebView2*, ICoreWebView2NavigationStartingEventArgs* args) override {
        LPWSTR raw = nullptr;
        if (FAILED(args->get_Uri(&raw))) return S_OK;
        std::wstring uri(raw); CoTaskMemFree(raw);
        if (uri.rfind(origin, 0) == 0 || uri.rfind(L"blob:" + origin, 0) == 0 || uri == L"about:blank") return S_OK;
        args->put_Cancel(TRUE); openExternal(uri); return S_OK;
    }
};
struct NewWindowHandler final : Callback<ICoreWebView2NewWindowRequestedEventHandler, &IID_ICoreWebView2NewWindowRequestedEventHandler> {
    HRESULT STDMETHODCALLTYPE Invoke(ICoreWebView2*, ICoreWebView2NewWindowRequestedEventArgs* args) override {
        args->put_Handled(TRUE);
        LPWSTR raw = nullptr;
        if (SUCCEEDED(args->get_Uri(&raw))) { openExternal(raw); CoTaskMemFree(raw); }
        return S_OK;
    }
};
struct PendingDownload {
    ICoreWebView2DownloadStartingEventArgs* args;
    ICoreWebView2Deferral* deferral;
    PendingDownload(ICoreWebView2DownloadStartingEventArgs* a, ICoreWebView2Deferral* d) : args(a), deferral(d) { args->AddRef(); }
    ~PendingDownload() { deferral->Complete(); deferral->Release(); args->Release(); }
};
struct DownloadHandler final : Callback<ICoreWebView2DownloadStartingEventHandler, &IID_ICoreWebView2DownloadStartingEventHandler> {
    HWND window;
    explicit DownloadHandler(HWND value) : window(value) {}
    HRESULT STDMETHODCALLTYPE Invoke(ICoreWebView2*, ICoreWebView2DownloadStartingEventArgs* args) override {
        ICoreWebView2Deferral* deferral = nullptr;
        if (FAILED(args->GetDeferral(&deferral))) { args->put_Cancel(TRUE); return S_OK; }
        auto pending = std::make_unique<PendingDownload>(args, deferral);
        if (PostMessageW(window, downloadMessage, 0, reinterpret_cast<LPARAM>(pending.get()))) pending.release();
        else args->put_Cancel(TRUE);
        return S_OK;
    }
};

struct Application {
    HWND window = nullptr;
    HMODULE loader = nullptr;
    ICoreWebView2Controller* controller = nullptr;
    ICoreWebView2* webView = nullptr;
    fs::path folder, pack;
    std::unique_ptr<LocalServer> server;
    std::wstring address;

    explicit Application(fs::path executable) : folder(std::move(executable)) {}
    ~Application() {
        if (controller) controller->Close();
        if (webView) webView->Release();
        if (controller) controller->Release();
        if (server) server->stop();
        // Keep the loader resident until process exit: COM callbacks may still own SDK objects.
    }
    void error(const std::wstring& message) { MessageBoxW(window, message.c_str(), L"Last Blade 2 Frame Lab", MB_OK | MB_ICONERROR); }
    void reload() { if (webView) webView->Navigate(address.c_str()); }
    void resize() { if (controller) { RECT bounds{}; GetClientRect(window, &bounds); controller->put_Bounds(bounds); } }
    void start() {
        if (!preferenceDemo()) {
            if (validPack(folder / L"data")) pack = folder / L"data";
            else if (auto saved = preferencePath(); validPack(saved)) pack = saved;
        }
        server = std::make_unique<LocalServer>(folder / L"web");
        server->useData(pack); server->start(); address = wide(server->address());
        auto loaderPath = (folder / L"WebView2Loader.dll").wstring();
        loader = LoadLibraryExW(loaderPath.c_str(), nullptr, LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_SYSTEM32);
        if (!loader) throw std::runtime_error("WebView2Loader.dll is missing. Extract the entire Windows ZIP before opening the app.");
        using CreateEnvironment = HRESULT(STDAPICALLTYPE*)(PCWSTR, PCWSTR, ICoreWebView2EnvironmentOptions*, ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler*);
        auto create = reinterpret_cast<CreateEnvironment>(GetProcAddress(loader, "CreateCoreWebView2EnvironmentWithOptions"));
        if (!create) throw std::runtime_error("The Microsoft WebView2 loader is incompatible.");
        PWSTR storage = nullptr;
        if (FAILED(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &storage))) throw std::runtime_error("Local app storage is unavailable.");
        auto userData = fs::path(storage) / L"LastBlade2FrameLab" / L"WebView2"; CoTaskMemFree(storage);
        auto handler = new EnvironmentHandler(this);
        auto result = create(nullptr, userData.c_str(), nullptr, handler); handler->Release();
        if (FAILED(result)) runtimeMissing();
    }
    void runtimeMissing() {
        error(L"The Microsoft Edge WebView2 Runtime could not start.\n\nInstall the Evergreen Runtime from Microsoft's official page, then reopen Frame Lab:\nhttps://developer.microsoft.com/microsoft-edge/webview2/#download-section\n\nThe app does not install anything automatically.");
        DestroyWindow(window);
    }
    void chooseData() {
        IFileOpenDialog* dialog = nullptr;
        if (FAILED(CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_IFileOpenDialog, reinterpret_cast<void**>(&dialog)))) return;
        FILEOPENDIALOGOPTIONS options{}; dialog->GetOptions(&options);
        dialog->SetOptions(options | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST);
        dialog->SetTitle(L"Choose a data pack containing manifest.json and extended");
        if (SUCCEEDED(dialog->Show(window))) {
            IShellItem* item = nullptr;
            if (SUCCEEDED(dialog->GetResult(&item))) {
                PWSTR selected = nullptr;
                if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &selected))) {
                    fs::path path(selected); CoTaskMemFree(selected);
                    if (!validPack(path)) error(L"This folder is not a complete data pack. Choose the folder containing manifest.json and extended.");
                    else { pack = path; server->useData(pack); remember(pack); reload(); }
                }
                item->Release();
            }
        }
        dialog->Release();
    }
    void saveDownload(PendingDownload* raw) {
        std::unique_ptr<PendingDownload> pending(raw);
        IFileSaveDialog* dialog = nullptr;
        if (FAILED(CoCreateInstance(CLSID_FileSaveDialog, nullptr, CLSCTX_INPROC_SERVER, IID_IFileSaveDialog, reinterpret_cast<void**>(&dialog)))) { pending->args->put_Cancel(TRUE); return; }
        LPWSTR suggested = nullptr;
        if (SUCCEEDED(pending->args->get_ResultFilePath(&suggested))) {
            auto name = fs::path(suggested).filename().wstring(); CoTaskMemFree(suggested);
            if (!name.empty()) dialog->SetFileName(name.c_str());
        }
        dialog->SetTitle(L"Save Frame Lab export");
        bool saved = false;
        if (SUCCEEDED(dialog->Show(window))) {
            IShellItem* item = nullptr;
            if (SUCCEEDED(dialog->GetResult(&item))) {
                PWSTR target = nullptr;
                if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &target))) {
                    if (SUCCEEDED(pending->args->put_ResultFilePath(target))) saved = true;
                    CoTaskMemFree(target);
                }
                item->Release();
            }
        }
        if (!saved) pending->args->put_Cancel(TRUE);
        // Keep WebView2's completion/error UI; only the destination picker is native.
        dialog->Release();
    }
};

HRESULT EnvironmentHandler::Invoke(HRESULT error, ICoreWebView2Environment* environment) {
    if (FAILED(error) || !environment) { app->runtimeMissing(); return S_OK; }
    auto handler = new ControllerHandler(app);
    auto result = environment->CreateCoreWebView2Controller(app->window, handler); handler->Release();
    if (FAILED(result)) app->runtimeMissing();
    return S_OK;
}
HRESULT ControllerHandler::Invoke(HRESULT error, ICoreWebView2Controller* value) {
    if (FAILED(error) || !value) { app->runtimeMissing(); return S_OK; }
    app->controller = value; value->AddRef();
    if (FAILED(value->get_CoreWebView2(&app->webView))) { app->runtimeMissing(); return S_OK; }
    ICoreWebView2Settings* settings = nullptr;
    if (SUCCEEDED(app->webView->get_Settings(&settings))) {
        settings->put_IsStatusBarEnabled(FALSE); settings->put_AreDefaultContextMenusEnabled(FALSE);
        settings->put_AreDevToolsEnabled(FALSE); settings->Release();
    }
    EventRegistrationToken token{};
    auto navigation = new NavigationHandler(app->address);
    app->webView->add_NavigationStarting(navigation, &token); navigation->Release();
    auto newWindow = new NewWindowHandler();
    app->webView->add_NewWindowRequested(newWindow, &token); newWindow->Release();
    ICoreWebView2_4* downloads = nullptr;
    if (FAILED(app->webView->QueryInterface(IID_ICoreWebView2_4, reinterpret_cast<void**>(&downloads)))) { app->runtimeMissing(); return S_OK; }
    auto download = new DownloadHandler(app->window);
    downloads->add_DownloadStarting(download, &token); download->Release(); downloads->Release();
    app->resize(); app->reload(); return S_OK;
}

LRESULT CALLBACK windowProcedure(HWND window, UINT message, WPARAM wParam, LPARAM lParam) {
    auto app = reinterpret_cast<Application*>(GetWindowLongPtrW(window, GWLP_USERDATA));
    if (message == WM_NCCREATE) {
        app = static_cast<Application*>(reinterpret_cast<CREATESTRUCTW*>(lParam)->lpCreateParams);
        app->window = window; SetWindowLongPtrW(window, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(app));
    }
    try {
        if (app) switch (message) {
        case WM_SIZE: app->resize(); return 0;
        case WM_MOVE: if (app->controller) app->controller->NotifyParentWindowPositionChanged(); return 0;
        case WM_GETMINMAXINFO: reinterpret_cast<MINMAXINFO*>(lParam)->ptMinTrackSize = {640, 500}; return 0;
        case WM_COMMAND:
            switch (LOWORD(wParam)) {
            case chooseDataCommand: app->chooseData(); break;
            case useDemoCommand: app->pack.clear(); app->server->useData({}); remember({}); app->reload(); break;
            case reloadCommand: app->reload(); break;
            case quitCommand: DestroyWindow(window); break;
            }
            return 0;
        case downloadMessage: app->saveDownload(reinterpret_cast<PendingDownload*>(lParam)); return 0;
        case WM_DESTROY:
            if (app->controller) app->controller->Close();
            // Complete pending deferrals even if the user closes during download startup.
            { MSG pending{}; while (PeekMessageW(&pending, window, downloadMessage, downloadMessage, PM_REMOVE)) {
                std::unique_ptr<PendingDownload> item(reinterpret_cast<PendingDownload*>(pending.lParam)); item->args->put_Cancel(TRUE);
            }}
            PostQuitMessage(0); return 0;
        }
    } catch (const std::exception& error) { if (app) app->error(wide(error.what())); }
    return DefWindowProcW(window, message, wParam, lParam);
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int show) {
    int argc = 0;
    auto argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    std::vector<std::wstring> arguments(argv, argv + argc); LocalFree(argv);
    // Explicit headless mode is for Windows black-box HTTP checks only. No WebView2/UI.
    if (arguments.size() > 1 && arguments[1] == L"--server-only") {
        try {
            fs::path web, data;
            for (size_t i = 2; i < arguments.size(); ++i) {
                if (i + 1 >= arguments.size()) throw std::runtime_error("Missing argument value.");
                if (arguments[i] == L"--web-root") web = arguments[++i];
                else if (arguments[i] == L"--data-root") data = arguments[++i];
                else throw std::runtime_error("Unknown server argument.");
            }
            LocalServer server(web); server.useData(data); server.start();
            HANDLE output = GetStdHandle(STD_OUTPUT_HANDLE);
            auto address = server.address() + "\n"; DWORD written = 0;
            WriteFile(output, address.data(), static_cast<DWORD>(address.size()), &written, nullptr);
            // The test harness owns this child process and terminates it after requests.
            Sleep(INFINITE);
        } catch (...) { return 1; }
    }
    if (FAILED(CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED))) return 1;
    int result = 1;
    try {
        SetProcessDPIAware();
        Application app(executableFolder());
        WNDCLASSEXW kind{}; kind.cbSize = sizeof(kind); kind.lpfnWndProc = windowProcedure;
        kind.hInstance = instance; kind.hCursor = LoadCursorW(nullptr, IDC_ARROW); kind.lpszClassName = L"LastBlade2FrameLabWindow";
        if (!RegisterClassExW(&kind)) throw std::runtime_error("Window class could not be registered.");
        HMENU menu = CreateMenu(), file = CreatePopupMenu();
        AppendMenuW(file, MF_STRING, chooseDataCommand, L"Choose Data Folder...\tCtrl+O");
        AppendMenuW(file, MF_STRING, useDemoCommand, L"Use Demo");
        AppendMenuW(file, MF_STRING, reloadCommand, L"Reload Viewer\tCtrl+R");
        AppendMenuW(file, MF_SEPARATOR, 0, nullptr); AppendMenuW(file, MF_STRING, quitCommand, L"Quit");
        AppendMenuW(menu, MF_POPUP, reinterpret_cast<UINT_PTR>(file), L"File");
        auto window = CreateWindowExW(0, kind.lpszClassName, L"Last Blade 2 - Frame Lab", WS_OVERLAPPEDWINDOW,
            CW_USEDEFAULT, CW_USEDEFAULT, 1280, 900, nullptr, menu, instance, &app);
        if (!window) throw std::runtime_error("Viewer window could not be created.");
        ShowWindow(window, show); UpdateWindow(window); app.start();
        ACCEL keys[]{{FVIRTKEY | FCONTROL, 'O', chooseDataCommand}, {FVIRTKEY | FCONTROL, 'R', reloadCommand}};
        HACCEL accelerators = CreateAcceleratorTableW(keys, 2);
        MSG message{};
        while (GetMessageW(&message, nullptr, 0, 0) > 0) {
            if (!TranslateAcceleratorW(window, accelerators, &message)) { TranslateMessage(&message); DispatchMessageW(&message); }
        }
        DestroyAcceleratorTable(accelerators); result = 0;
    } catch (const std::exception& error) {
        MessageBoxW(nullptr, wide(error.what()).c_str(), L"Last Blade 2 Frame Lab", MB_OK | MB_ICONERROR);
    }
    CoUninitialize(); return result;
}
