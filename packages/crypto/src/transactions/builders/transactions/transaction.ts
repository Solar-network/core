import { TransactionTypeGroup } from "../../../enums";
import { MemoLengthExceededError, MissingTransactionSignatureError, TransactionSchemaError } from "../../../errors";
import { Keys } from "../../../identities";
import { IKeyPair, ITransaction, ITransactionData } from "../../../interfaces";
import { configManager } from "../../../managers/config";
import { NetworkType } from "../../../types";
import { BigNumber } from "../../../utils";
import { TransactionFactory, Utils } from "../..";
import { Signer } from "../../signer";
import { Verifier } from "../../verifier";

export abstract class TransactionBuilder<TBuilder extends TransactionBuilder<TBuilder>> {
    public data: ITransactionData;

    private disableVersionCheck = true;

    public constructor() {
        this.data = {
            id: undefined,
            typeGroup: TransactionTypeGroup.Test,
            nonce: BigNumber.ZERO,
            memo: undefined,
            version: 3,
        } as ITransactionData;
    }

    public build(data: Partial<ITransactionData> = {}): ITransaction {
        return TransactionFactory.fromData({ ...this.data, ...data }, false, {
            disableVersionCheck: this.disableVersionCheck,
        });
    }

    public version(version: number): TBuilder {
        this.data.version = version;
        this.disableVersionCheck = true;
        return this.instance();
    }

    public typeGroup(typeGroup: number): TBuilder {
        this.data.typeGroup = typeGroup;

        return this.instance();
    }

    public nonce(nonce: string): TBuilder {
        if (nonce) {
            this.data.nonce = BigNumber.make(nonce);
        }

        return this.instance();
    }

    public network(network: number): TBuilder {
        this.data.network = network;

        return this.instance();
    }

    public fee(fee: string): TBuilder {
        if (fee) {
            this.data.fee = BigNumber.make(fee);
        }

        return this.instance();
    }

    public senderPublicKey(publicKey: string): TBuilder {
        this.data.senderPublicKey = publicKey;

        return this.instance();
    }

    public memo(memo: string): TBuilder {
        const limit: number = 255;

        if (memo) {
            if (Buffer.from(memo).length > limit) {
                throw new MemoLengthExceededError(limit);
            }

            this.data.memo = memo;
        }

        return this.instance();
    }

    public vendorField(memo: string): TBuilder {
        return this.memo(memo);
    }

    public sign(passphrase: string): TBuilder {
        const keys: IKeyPair = Keys.fromPassphrase(passphrase);
        return this.signWithKeyPair(keys);
    }

    public signWithWif(wif: string, networkWif?: number): TBuilder {
        const keys: IKeyPair = Keys.fromWIF(wif, {
            wif: networkWif || configManager.get("network.wif"),
        } as NetworkType);

        return this.signWithKeyPair(keys);
    }

    public secondSign(secondPassphrase: string): TBuilder {
        return this.secondSignWithKeyPair(Keys.fromPassphrase(secondPassphrase));
    }

    public secondSignWithWif(wif: string, networkWif?: number): TBuilder {
        const keys = Keys.fromWIF(wif, {
            wif: networkWif || configManager.get("network.wif"),
        } as NetworkType);

        return this.secondSignWithKeyPair(keys);
    }

    public multiSign(passphrase: string, index: number): TBuilder {
        const keys: IKeyPair = Keys.fromPassphrase(passphrase);
        return this.multiSignWithKeyPair(index, keys);
    }

    public multiSignWithWif(index: number, wif: string, networkWif?: number): TBuilder {
        const keys = Keys.fromWIF(wif, {
            wif: networkWif || configManager.get("network.wif"),
        } as NetworkType);

        return this.multiSignWithKeyPair(index, keys);
    }

    public verify(): boolean {
        return Verifier.verifyHash(this.data, this.disableVersionCheck);
    }

    public getStruct(): ITransactionData {
        if (!this.data.senderPublicKey || (!this.data.signature && !this.data.signatures)) {
            throw new MissingTransactionSignatureError();
        }

        const struct: ITransactionData = {
            id: Utils.getId(this.data, { disableVersionCheck: this.disableVersionCheck }).toString(),
            signature: this.data.signature,
            secondSignature: this.data.secondSignature,
            version: this.data.version,
            type: this.data.type,
            fee: this.data.fee,
            senderPublicKey: this.data.senderPublicKey,
            network: this.data.network,
            memo: this.data.memo,
        } as ITransactionData;

        struct.typeGroup = this.data.typeGroup;
        struct.nonce = this.data.nonce;

        if (Array.isArray(this.data.signatures)) {
            struct.signatures = this.data.signatures;
        }

        return struct;
    }

    protected validate(struct: ITransactionData) {
        const { error } = Verifier.verifySchema(struct, true);

        if (error) {
            throw new TransactionSchemaError(error);
        }
    }

    private signWithKeyPair(keys: IKeyPair): TBuilder {
        this.data.senderPublicKey = keys.publicKey;

        this.data.signature = Signer.sign(this.getSigningObject(), keys, {
            disableVersionCheck: this.disableVersionCheck,
        });

        return this.instance();
    }

    private secondSignWithKeyPair(keys: IKeyPair): TBuilder {
        this.data.secondSignature = Signer.secondSign(this.getSigningObject(), keys);
        return this.instance();
    }

    private multiSignWithKeyPair(index: number, keys: IKeyPair): TBuilder {
        if (!this.data.signatures) {
            this.data.signatures = [];
        }

        Signer.multiSign(this.getSigningObject(), keys, index);

        return this.instance();
    }

    private getSigningObject(): ITransactionData {
        const data: ITransactionData = {
            ...this.data,
        };

        for (const key of Object.keys(data)) {
            if (["model", "network", "id"].includes(key)) {
                delete data[key];
            }
        }

        return data;
    }

    protected abstract instance(): TBuilder;
}
