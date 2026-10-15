// Native host runner for black-box HTTP tests of the exact shipping transport.
// This translation unit is never included in the Windows app or public ZIP.
#include "LocalServer.hpp"
#include <iostream>
#include <string>
int main(int argc, char** argv) {
    if (argc < 2 || argc > 3) return 2;
    try {
        LocalServer server(std::filesystem::u8path(argv[1]));
        if (argc == 3) server.useData(std::filesystem::u8path(argv[2]));
        server.start(); std::cout << server.address() << std::endl;
        std::string line; std::getline(std::cin, line);
        server.stop(); return 0;
    } catch (const std::exception& error) { std::cerr << error.what() << std::endl; return 1; }
}
