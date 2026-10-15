import Foundation
import Network
import Darwin

/// Read-only static server. Only the selected data directory and built UI are served.
final class LocalServer {
    private let webRoot: URL
    private let queue = DispatchQueue(label: "frame-lab.http")
    private let lock = NSLock()
    private var packRoot: URL?
    private var listener: NWListener?
    private var connections: [ObjectIdentifier: NWConnection] = [:]
    private(set) var port: UInt16 = 0

    init(webRoot: URL, dataRoot: URL?) {
        self.webRoot = webRoot.resolvingSymlinksInPath().standardizedFileURL
        self.packRoot = dataRoot?.resolvingSymlinksInPath().standardizedFileURL
    }
    func useData(_ directory: URL?) {
        lock.lock(); defer { lock.unlock() }
        packRoot = directory?.resolvingSymlinksInPath().standardizedFileURL
    }
    func start(ready: @escaping (Result<URL, Error>) -> Void) throws {
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: .any)
        let listener = try NWListener(using: parameters)
        self.listener = listener
        listener.stateUpdateHandler = { [weak self] state in
            guard let self = self else { return }
            switch state {
            case .ready:
                self.port = listener.port!.rawValue
                ready(.success(URL(string: "http://127.0.0.1:\(self.port)/")!))
            case .failed(let error): ready(.failure(error))
            default: break
            }
        }
        listener.newConnectionHandler = { [weak self] connection in
            guard let self = self else { connection.cancel(); return }
            let id = ObjectIdentifier(connection)
            self.connections[id] = connection
            connection.stateUpdateHandler = { [weak self] state in
                switch state {
                case .cancelled, .failed: self?.connections.removeValue(forKey: id)
                default: break
                }
            }
            connection.start(queue: self.queue)
            self.receive(connection, collected: Data())
            self.queue.asyncAfter(deadline: .now() + 15) { [weak connection] in connection?.cancel() }
        }
        listener.start(queue: queue)
    }
    func stop() {
        queue.async { [weak self] in
            self?.listener?.cancel()
            self?.connections.values.forEach { $0.cancel() }
            self?.connections.removeAll()
        }
    }
    private func receive(_ connection: NWConnection, collected: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 16_384) { [weak self] data, _, done, error in
            guard let self = self else { return }
            var bytes = collected; if let data = data { bytes.append(data) }
            if bytes.count > 16_384 { self.respond(connection, status: 431); return }
            if bytes.range(of: Data("\r\n\r\n".utf8)) != nil { self.handle(connection, request: bytes); return }
            if done || error != nil { connection.cancel(); return }
            self.receive(connection, collected: bytes)
        }
    }
    private func handle(_ connection: NWConnection, request: Data) {
        guard let text = String(data: request, encoding: .utf8) else { respond(connection, status: 400); return }
        let lines = text.components(separatedBy: "\r\n")
        let first = lines[0].split(separator: " ")
        guard first.count == 3, ["HTTP/1.1", "HTTP/1.0"].contains(String(first[2])) else { respond(connection, status: 400); return }
        let method = String(first[0]), head = method == "HEAD"
        guard method == "GET" || head else { respond(connection, status: 405); return }
        var headers: [String: String] = [:]
        for line in lines.dropFirst() {
            if line.isEmpty { break }
            guard let colon = line.firstIndex(of: ":") else { respond(connection, status: 400); return }
            let key = line[..<colon].lowercased()
            if headers[key] != nil { respond(connection, status: 400); return }
            headers[key] = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
        }
        let host = "127.0.0.1:\(port)"
        guard headers["host"] == host else { respond(connection, status: 403); return }
        if let origin = headers["origin"], origin != "http://\(host)" { respond(connection, status: 403); return }
        if headers["sec-fetch-site"] == "cross-site" { respond(connection, status: 403); return }
        let target = String(first[1]).components(separatedBy: "?")[0]
        guard target.hasPrefix("/"), let decoded = target.removingPercentEncoding,
              !decoded.contains("\0"), !decoded.contains("\\"),
              !decoded.split(separator: "/").contains("..") else { respond(connection, status: 403); return }
        let root: URL, relative: String
        if decoded.hasPrefix("/data/") {
            lock.lock(); let selected = packRoot; lock.unlock()
            guard let selected = selected else { respond(connection, status: 404, head: head); return }
            root = selected; relative = String(decoded.dropFirst(6))
        } else {
            root = webRoot; relative = decoded == "/" ? "index.html" : String(decoded.dropFirst())
        }
        let file = root.appendingPathComponent(relative).resolvingSymlinksInPath().standardizedFileURL
        guard file.path.hasPrefix(root.path + "/") else { respond(connection, status: 403, head: head); return }
        // Foundation attributesOfItem also reads extended attributes. Avoid that
        // work (and file-provider stalls) when HTTP needs only mode and size.
        var info = stat()
        guard file.path.withCString({ lstat($0, &info) }) == 0,
              info.st_mode & mode_t(S_IFMT) == mode_t(S_IFREG) else { respond(connection, status: 404, head: head); return }
        let size = Int(info.st_size)
        let content: Data
        if head { content = Data() }
        else { guard let bytes = try? Data(contentsOf: file, options: .mappedIfSafe) else { respond(connection, status: 404); return }; content = bytes }
        respond(connection, status: 200, body: content, mime: Self.mime(file.pathExtension), head: head, length: size)
    }
    private static func mime(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json"
        case "csv": return "text/csv; charset=utf-8"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "svg": return "image/svg+xml"
        default: return "application/octet-stream"
        }
    }
    private func respond(_ connection: NWConnection, status: Int, body: Data = Data(), mime: String = "text/plain", head: Bool = false, length: Int? = nil) {
        let reasons = [200: "OK", 400: "Bad Request", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed", 431: "Request Header Fields Too Large"]
        let header = "HTTP/1.1 \(status) \(reasons[status] ?? "Error")\r\nContent-Type: \(mime)\r\nContent-Length: \(length ?? body.count)\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n"
        connection.send(content: Data(header.utf8), completion: .contentProcessed { error in
            if error != nil || head || body.isEmpty { connection.cancel(); return }
            connection.send(content: body, completion: .contentProcessed { _ in connection.cancel() })
        })
    }
}
