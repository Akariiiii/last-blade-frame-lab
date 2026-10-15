#include "LocalServer.hpp"
#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <ws2tcpip.h>
using Socket = SOCKET;
constexpr Socket invalidSocket = INVALID_SOCKET;
static void closeSocket(Socket s) { closesocket(s); }
static void interruptSocket(Socket s) { shutdown(s, SD_BOTH); }
#else
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
using Socket = int;
constexpr Socket invalidSocket = -1;
static void closeSocket(Socket s) { close(s); }
static void interruptSocket(Socket s) { shutdown(s, SHUT_RDWR); }
#endif
#include <algorithm>
#include <atomic>
#include <condition_variable>
#include <cctype>
#include <fstream>
#include <map>
#include <mutex>
#include <set>
#include <stdexcept>
#include <thread>
#include <vector>

namespace fs = std::filesystem;
namespace {
std::string lower(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return value;
}
std::string trim(std::string value) {
    const auto first = value.find_first_not_of(" \t");
    if (first == std::string::npos) return {};
    return value.substr(first, value.find_last_not_of(" \t") - first + 1);
}
bool inside(const fs::path& root, const fs::path& file) {
    auto r = root.begin(), f = file.begin();
    for (; r != root.end(); ++r, ++f) {
        if (f == file.end()) return false;
#ifdef _WIN32
        if (_wcsicmp(r->c_str(), f->c_str()) != 0) return false;
#else
        if (*r != *f) return false;
#endif
    }
    return f != file.end();
}
bool decode(const std::string& target, std::string& out) {
    if (target.empty() || target[0] != '/') return false;
    const auto hex = [](char c) -> int {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'a' && c <= 'f') return c - 'a' + 10;
        if (c >= 'A' && c <= 'F') return c - 'A' + 10;
        return -1;
    };
    for (size_t i = 0; i < target.size() && target[i] != '?'; ++i) {
        unsigned char c = target[i];
        if (c == '%') {
            if (i + 2 >= target.size()) return false;
            int a = hex(target[i + 1]), b = hex(target[i + 2]);
            if (a < 0 || b < 0) return false;
            c = static_cast<unsigned char>(a * 16 + b); i += 2;
        }
        if (c == 0 || c == '\\' || c == ':' || c < 32 || c == 127) return false;
        out.push_back(static_cast<char>(c));
    }
    if (out.rfind("//", 0) == 0) return false;
    size_t start = 0;
    while (start <= out.size()) {
        auto end = out.find('/', start);
        if (out.substr(start, end - start) == "..") return false;
        if (end == std::string::npos) break;
        start = end + 1;
    }
    return true;
}
std::string mime(const fs::path& file) {
    const auto ext = lower(file.extension().string());
    if (ext == ".html") return "text/html; charset=utf-8";
    if (ext == ".js" || ext == ".mjs") return "text/javascript; charset=utf-8";
    if (ext == ".css") return "text/css; charset=utf-8";
    if (ext == ".json") return "application/json";
    if (ext == ".csv") return "text/csv; charset=utf-8";
    if (ext == ".png") return "image/png";
    if (ext == ".jpg" || ext == ".jpeg") return "image/jpeg";
    if (ext == ".svg") return "image/svg+xml";
    return "application/octet-stream";
}
bool sendAll(Socket socket, const char* bytes, size_t count) {
    while (count) {
        const int sent = send(socket, bytes, static_cast<int>(std::min<size_t>(count, 64 * 1024)),
#ifdef MSG_NOSIGNAL
            MSG_NOSIGNAL
#else
            0
#endif
        );
        if (sent <= 0) return false;
        bytes += sent; count -= static_cast<size_t>(sent);
    }
    return true;
}
bool header(Socket socket, int status, uintmax_t size = 0, const std::string& type = "text/plain") {
    const std::map<int, std::string> reasons{{200,"OK"},{400,"Bad Request"},{403,"Forbidden"},{404,"Not Found"},{405,"Method Not Allowed"},{431,"Request Header Fields Too Large"}};
    const auto text = "HTTP/1.1 " + std::to_string(status) + " " + reasons.at(status) +
        "\r\nContent-Type: " + type + "\r\nContent-Length: " + std::to_string(size) +
        "\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n";
    return sendAll(socket, text.data(), text.size());
}
}

struct LocalServer::State : std::enable_shared_from_this<LocalServer::State> {
    fs::path webRoot, packRoot;
    std::mutex mutex;
    std::condition_variable idle;
    std::set<Socket> clients;
    std::atomic<bool> running{false};
    Socket listener = invalidSocket;
    unsigned short port = 0;
    std::thread acceptThread;
#ifdef _WIN32
    bool winsockReady = false;
#endif
    explicit State(fs::path web) : webRoot(fs::canonical(web)) {}
    void handle(Socket socket) {
        try { request(socket); } catch (...) { header(socket, 404); }
        {
            std::lock_guard<std::mutex> guard(mutex);
            clients.erase(socket);
            closeSocket(socket);
        }
        idle.notify_all();
    }
    void request(Socket socket) {
        std::string bytes;
        char buffer[4096];
        size_t terminator;
        while ((terminator = bytes.find("\r\n\r\n")) == std::string::npos) {
            int count = recv(socket, buffer, sizeof(buffer), 0);
            if (count <= 0) return;
            bytes.append(buffer, count);
            if (bytes.size() > 16384) { header(socket, 431); return; }
        }
        const auto end = bytes.find("\r\n");
        const auto line = bytes.substr(0, end);
        auto a = line.find(' '), b = line.find(' ', a == std::string::npos ? 0 : a + 1);
        if (a == std::string::npos || b == std::string::npos ||
            (line.substr(b + 1) != "HTTP/1.1" && line.substr(b + 1) != "HTTP/1.0")) { header(socket, 400); return; }
        const auto method = line.substr(0, a);
        const bool head = method == "HEAD";
        if (method != "GET" && !head) { header(socket, 405); return; }
        std::map<std::string, std::string> headers;
        for (size_t start = end + 2; start < terminator; ) {
            auto stop = bytes.find("\r\n", start), colon = bytes.find(':', start);
            if (colon == std::string::npos || colon >= stop) { header(socket, 400); return; }
            auto name = lower(bytes.substr(start, colon - start));
            if (!headers.emplace(name, trim(bytes.substr(colon + 1, stop - colon - 1))).second) { header(socket, 400); return; }
            start = stop + 2;
        }
        const auto host = "127.0.0.1:" + std::to_string(port);
        if (headers["host"] != host || (headers.count("origin") && headers["origin"] != "http://" + host) ||
            headers["sec-fetch-site"] == "cross-site") { header(socket, 403); return; }
        std::string decoded;
        if (!decode(line.substr(a + 1, b - a - 1), decoded)) { header(socket, 403); return; }
        fs::path root;
        std::string relative;
        if (decoded.rfind("/data/", 0) == 0) {
            std::lock_guard<std::mutex> guard(mutex);
            root = packRoot; relative = decoded.substr(6);
            if (root.empty()) { header(socket, 404); return; }
        } else {
            root = webRoot; relative = decoded == "/" ? "index.html" : decoded.substr(1);
        }
        std::error_code error;
        auto file = fs::canonical(root / fs::u8path(relative), error);
        if (error) { header(socket, 404); return; }
        if (!inside(root, file)) { header(socket, 403); return; }
        if (!fs::is_regular_file(file, error) || error) { header(socket, 404); return; }
        auto size = fs::file_size(file, error);
        if (error) { header(socket, 404); return; }
        // Open before sending 200 so vanished/unreadable files produce a failure.
        std::ifstream stream(file, std::ios::binary);
        if (!stream) { header(socket, 404); return; }
        if (!header(socket, 200, size, mime(file)) || head) return;
        char chunk[64 * 1024];
        while (size && stream) {
            stream.read(chunk, static_cast<std::streamsize>(std::min<uintmax_t>(size, sizeof(chunk))));
            auto count = stream.gcount();
            if (count <= 0 || !sendAll(socket, chunk, static_cast<size_t>(count))) return;
            size -= static_cast<uintmax_t>(count);
        }
    }
};

LocalServer::LocalServer(fs::path root) : state(std::make_shared<State>(std::move(root))) {}
LocalServer::~LocalServer() { stop(); }
void LocalServer::useData(const fs::path& directory) {
    const auto canonical = directory.empty() ? fs::path{} : fs::canonical(directory);
    std::lock_guard<std::mutex> guard(state->mutex); state->packRoot = canonical;
}
void LocalServer::start() {
    if (state->running) throw std::runtime_error("Server is already running.");
#ifdef _WIN32
    WSADATA data{};
    if (WSAStartup(MAKEWORD(2,2), &data)) throw std::runtime_error("Windows networking could not start.");
    state->winsockReady = true;
#endif
    state->listener = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (state->listener == invalidSocket) throw std::runtime_error("Local socket could not be created.");
    sockaddr_in endpoint{}; endpoint.sin_family = AF_INET; endpoint.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (bind(state->listener, reinterpret_cast<sockaddr*>(&endpoint), sizeof(endpoint)) || listen(state->listener, 16))
        throw std::runtime_error("Local viewer could not listen.");
#ifdef _WIN32
    int size = sizeof(endpoint);
#else
    socklen_t size = sizeof(endpoint);
#endif
    if (getsockname(state->listener, reinterpret_cast<sockaddr*>(&endpoint), &size)) throw std::runtime_error("Local port could not be read.");
    state->port = ntohs(endpoint.sin_port); state->running = true;
    auto shared = state;
    const auto listening = state->listener;
    state->acceptThread = std::thread([shared, listening] {
        while (shared->running) {
            Socket client = accept(listening, nullptr, nullptr);
            if (client == invalidSocket) break;
#ifdef _WIN32
            DWORD timeout = 5000;
            setsockopt(client, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout));
            setsockopt(client, SOL_SOCKET, SO_SNDTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout));
#else
            timeval timeout{5, 0};
            setsockopt(client, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
            setsockopt(client, SOL_SOCKET, SO_SNDTIMEO, &timeout, sizeof(timeout));
#ifdef SO_NOSIGPIPE
            int noSignal = 1; setsockopt(client, SOL_SOCKET, SO_NOSIGPIPE, &noSignal, sizeof(noSignal));
#endif
#endif
            std::lock_guard<std::mutex> guard(shared->mutex);
            if (!shared->running || shared->clients.size() >= 16) { closeSocket(client); continue; }
            shared->clients.insert(client);
            try { std::thread([shared, client] { shared->handle(client); }).detach(); }
            catch (...) { shared->clients.erase(client); closeSocket(client); }
        }
    });
}
void LocalServer::stop() {
    state->running = false;
    if (state->listener != invalidSocket) { interruptSocket(state->listener); closeSocket(state->listener); state->listener = invalidSocket; }
    if (state->acceptThread.joinable()) state->acceptThread.join();
    std::unique_lock<std::mutex> guard(state->mutex);
    for (auto socket : state->clients) interruptSocket(socket);
    state->idle.wait(guard, [this] { return state->clients.empty(); });
#ifdef _WIN32
    if (state->winsockReady) { WSACleanup(); state->winsockReady = false; }
#endif
}
std::string LocalServer::address() const { return "http://127.0.0.1:" + std::to_string(state->port) + "/"; }
