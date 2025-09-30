#include "wallet.h"
#include <cstdlib>
#include <ctime>

Wallet::Wallet() {
    generateKeys();
}

void Wallet::generateKeys() {
    srand(time(0));
    privateKey = "priv" + std::to_string(rand() % 1000000);
    publicKey = "pub" + std::to_string(rand() % 1000000);
}

std::string Wallet::getPublicKey() {
    return publicKey;
}

std::string Wallet::getPrivateKey() {
    return privateKey;
}
