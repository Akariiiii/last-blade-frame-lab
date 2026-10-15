#pragma once
#include <filesystem>
#include <memory>
#include <string>

// The transport is shared by the Windows shell and headless host-side tests.
// No directory listing, writes, proxying, external binding, or access logs.
class LocalServer {
public:
    explicit LocalServer(std::filesystem::path webRoot);
    ~LocalServer();
    LocalServer(const LocalServer&) = delete;
    LocalServer& operator=(const LocalServer&) = delete;
    void useData(const std::filesystem::path& directory);
    void start();
    void stop();
    std::string address() const;
private:
    struct State;
    std::shared_ptr<State> state;
};
