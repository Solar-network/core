export interface IKeyPair {
    publicKey: { secp256k1: string; bls12381: string };
    privateKey: string;
    compressed: boolean;
}
