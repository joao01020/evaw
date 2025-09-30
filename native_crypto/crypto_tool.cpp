// crypto_tool.cpp
#include <iostream>
#include <fstream>
#include <string>
#include <cstdlib>
#include <ctime>

std::string generate_seed() {
    std::string chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    std::string seed;
    for (int i = 0; i < 64; ++i) {
        seed += chars[rand() % chars.size()];
    }
    return seed;
}

int main(int argc, char* argv[]) {
    srand((unsigned)time(0));

    if (argc < 2) {
        std::cerr << "Usage: crypto_tool <command>\n";
        return 1;
    }

    std::string command = argv[1];

    if (command == "gen-seed") {
        std::cout << generate_seed() << std::endl;
        return 0;
    } 
    else if ((command == "encrypt" || command == "decrypt") && argc == 5) {
        std::string key = argv[2];
        std::string infile = argv[3];
        std::string outfile = argv[4];

        std::ifstream fin(infile, std::ios::binary);
        if (!fin) { std::cerr << "Input file error\n"; return 1; }

        std::ofstream fout(outfile, std::ios::binary);
        if (!fout) { std::cerr << "Output file error\n"; return 1; }

        fout << fin.rdbuf();
        fin.close();
        fout.close();
        return 0;
    }
    else {
        std::cerr << "Invalid command or arguments\n";
        return 1;
    }
}
