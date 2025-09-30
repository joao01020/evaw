#pragma once
#include <string>

class Wallet {
public:
    Wallet();
    std::string getPublicKey();
    std::string getPrivateKey();
private:
    std::string publicKey;
    std::string privateKey;
    void generateKeys();
};
