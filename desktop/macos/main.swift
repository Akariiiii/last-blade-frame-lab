import AppKit
import WebKit

// Headless serving is used only by the black-box HTTP/package tests.
if CommandLine.arguments.contains("--server-only") {
    func argument(_ name: String) -> String? {
        guard let i = CommandLine.arguments.firstIndex(of: name), i + 1 < CommandLine.arguments.count else { return nil }
        return CommandLine.arguments[i + 1]
    }
    guard let web = argument("--web-root") else { fatalError("Missing --web-root") }
    let testServer = LocalServer(webRoot: URL(fileURLWithPath: web), dataRoot: argument("--data-root").map { URL(fileURLWithPath: $0) })
    do {
        try testServer.start { result in
            switch result {
            case .success(let url): print(url.absoluteString); fflush(stdout)
            case .failure(let error): fputs("\(error)\n", stderr); exit(1)
            }
        }
    } catch { fputs("\(error)\n", stderr); exit(1) }
    dispatchMain()
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKDownloadDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var server: LocalServer!
    private var address: URL?
    private var pack: URL?
    private var pendingDownloads: [ObjectIdentifier: URL] = [:]

    func applicationDidFinishLaunching(_ notification: Notification) {
        let resources = Bundle.main.resourceURL!
        let adjacent = Bundle.main.bundleURL.deletingLastPathComponent().appendingPathComponent("data")
        if UserDefaults.standard.bool(forKey: "useDemo") { pack = nil }
        else if validPack(adjacent) { pack = adjacent }
        else if let remembered = UserDefaults.standard.string(forKey: "dataDirectory"), validPack(URL(fileURLWithPath: remembered)) { pack = URL(fileURLWithPath: remembered) }
        let menu = NSMenu()
        let appItem = NSMenuItem(); menu.addItem(appItem)
        let appMenu = NSMenu(); appItem.submenu = appMenu
        for (title, action, key) in [("About Frame Lab", #selector(showAbout), ""), ("Reload Viewer", #selector(reloadViewer), "r"), ("Choose Data Folder…", #selector(chooseData), "o"), ("Use Demo", #selector(useDemo), ""), ("Quit Frame Lab", #selector(quit), "q")] {
            let item = NSMenuItem(title: title, action: action, keyEquivalent: key); item.target = self; appMenu.addItem(item)
        }
        NSApp.mainMenu = menu
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 900), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        let version = Bundle.main.object(forInfoDictionaryKey: "FrameLabVersion") as? String ?? "unknown"
        window.title = "Last Blade 2 · Frame Lab v\(version)"; window.minSize = NSSize(width: 640, height: 500); window.center()
        webView = WKWebView(frame: window.contentView!.bounds); webView.autoresizingMask = [.width, .height]; webView.navigationDelegate = self
        window.contentView!.addSubview(webView); window.makeKeyAndOrderFront(nil)
        server = LocalServer(webRoot: resources.appendingPathComponent("web"), dataRoot: pack)
        do {
            try server.start { [weak self] result in
                DispatchQueue.main.async {
                    switch result {
                    case .success(let url): self?.address = url; self?.reloadViewer()
                    case .failure(let error): self?.showError("Could not start the local viewer: \(error.localizedDescription)")
                    }
                }
            }
        } catch { showError(error.localizedDescription) }
    }
    @objc private func showAbout() {
        let version = Bundle.main.object(forInfoDictionaryKey: "FrameLabVersion") as? String ?? "unknown"
        NSApp.orderFrontStandardAboutPanel(options: [.applicationVersion: version])
    }
    private func validPack(_ url: URL) -> Bool {
        ["manifest.json", "extended/index.json", "extended/metrics.json", "extended/profiles.json"].allSatisfy { FileManager.default.fileExists(atPath: url.appendingPathComponent($0).path) }
    }
    @objc func reloadViewer() { if let address = address { webView.load(URLRequest(url: address)) } }
    @objc func chooseData() {
        let panel = NSOpenPanel(); panel.canChooseDirectories = true; panel.canChooseFiles = false; panel.allowsMultipleSelection = false
        panel.message = "Choose a recorded data pack containing manifest.json and extended/."; panel.prompt = "Use Data"
        panel.beginSheetModal(for: window) { [weak self] result in
            guard result == .OK, let self = self, let selected = panel.url else { return }
            guard self.validPack(selected) else { self.showError("This folder is not a complete viewer data pack."); return }
            self.pack = selected; self.server.useData(selected); UserDefaults.standard.set(false, forKey: "useDemo"); UserDefaults.standard.set(selected.path, forKey: "dataDirectory"); self.reloadViewer()
        }
    }
    @objc func useDemo() { pack = nil; server.useData(nil); UserDefaults.standard.set(true, forKey: "useDemo"); UserDefaults.standard.removeObject(forKey: "dataDirectory"); reloadViewer() }
    @objc func quit() { NSApp.terminate(nil) }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) { server?.stop() }
    private func showError(_ message: String) { let alert = NSAlert(); alert.messageText = "Frame Lab"; alert.informativeText = message; alert.beginSheetModal(for: window) }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if navigationAction.shouldPerformDownload { decisionHandler(.download); return }
        if url.scheme == "blob" || url.scheme == "about" || url.host == "127.0.0.1" && url.port == address?.port { decisionHandler(.allow); return }
        if ["https", "http"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel(); panel.nameFieldStringValue = suggestedFilename; panel.canCreateDirectories = true
        panel.beginSheetModal(for: window) { [weak self] result in
            let destination = result == .OK ? panel.url : nil
            if let destination = destination { self?.pendingDownloads[ObjectIdentifier(download)] = destination }
            completionHandler(destination)
        }
    }
    func downloadDidFinish(_ download: WKDownload) { pendingDownloads.removeValue(forKey: ObjectIdentifier(download)) }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) { pendingDownloads.removeValue(forKey: ObjectIdentifier(download)); showError("Download failed: \(error.localizedDescription)") }
}
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
