import { TransactionHeaderType, TransactionTypeGroup } from "../../../enums";
import { MemoLengthExceededError, MissingTransactionSignatureError, TransactionSchemaError } from "../../../errors";
import { Address, Keys } from "../../../identities";
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
            headerType: TransactionHeaderType.Standard,
            id: undefined,
            memo: undefined,
            nonce: BigNumber.ZERO,
            typeGroup: TransactionTypeGroup.Test,
            version: 3,
            signatures: {},
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

    public senderId(senderId: string): TBuilder {
        this.data.senderId = senderId;

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

    public sign(mnemonic: string): TBuilder {
        const keys: IKeyPair = Keys.fromMnemonic(mnemonic);
        return this.signWithKeyPair(keys);
    }

    public signWithWif(wif: string, networkWif?: number): TBuilder {
        const keys: IKeyPair = Keys.fromWIF(wif, {
            wif: networkWif || configManager.get("network.wif"),
        } as NetworkType);

        return this.signWithKeyPair(keys);
    }

    public extraSign(mnemonic: string): TBuilder {
        return this.extraSignWithKeyPair(Keys.fromMnemonic(mnemonic));
    }

    public extraSignWithWif(wif: string, networkWif?: number): TBuilder {
        const keys = Keys.fromWIF(wif, {
            wif: networkWif || configManager.get("network.wif"),
        } as NetworkType);

        return this.extraSignWithKeyPair(keys);
    }

    public verify(): boolean {
        return Verifier.verifyHash(this.data, this.disableVersionCheck);
    }

    public getStruct(): ITransactionData {
        if (!this.data.senderPublicKey || !this.data.signatures!.primary) {
            throw new MissingTransactionSignatureError();
        }

        const struct: ITransactionData = {
            fee: this.data.fee,
            headerType: this.data.headerType,
            id: Utils.getId(this.data, { disableVersionCheck: this.disableVersionCheck }).toString(),
            memo: this.data.memo,
            network: this.data.network,
            senderId: this.data.senderId,
            senderPublicKey: this.data.senderPublicKey,
            signatures: this.data.signatures,
            type: this.data.type,
            version: this.data.version,
        } as ITransactionData;

        struct.typeGroup = this.data.typeGroup;
        struct.nonce = this.data.nonce;

        Object.keys(struct).forEach((key) => struct[key] === undefined && delete struct[key]);

        return struct;
    }

    protected validate(struct: ITransactionData) {
        const { error } = Verifier.verifySchema(struct, true);

        if (error) {
            throw new TransactionSchemaError(error);
        }
    }

    private signWithKeyPair(keys: IKeyPair): TBuilder {
        this.data.senderPublicKey = keys.publicKey.secp256k1;

        if (!this.data.senderId) {
            this.data.senderId = Address.fromPublicKey(this.data.senderPublicKey);
        }

        if (this.data.senderId === Address.fromPublicKey(this.data.senderPublicKey)) {
            this.data.headerType = TransactionHeaderType.Standard;
        } else {
            this.data.headerType = TransactionHeaderType.Extended;
        }

        Signer.sign(this.getSigningObject(), keys, {
            disableVersionCheck: this.disableVersionCheck,
        });

        return this.instance();
    }

    private extraSignWithKeyPair(keys: IKeyPair): TBuilder {
        if (!this.data.signatures!.primary) {
            throw new MissingTransactionSignatureError();
        }

        Signer.extraSign(this.getSigningObject(), keys);

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
