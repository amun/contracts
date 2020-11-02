function toUint_8_24_Format(source) {
    const binaryString = source.toString(2);
    const shift =
      BigInt(binaryString.length) > 24n ? BigInt(binaryString.length) - 24n : 0n;
    const bits24 = source >> shift;
    const shiftComplement = "0".repeat(2 - shift.toString(16).length);
    const bitsComplement = "0".repeat(6 - bits24.toString(16).length);
    return `${shiftComplement}${shift.toString(
      16
    )}${bitsComplement}${bits24.toString(16)}`;
  }
  function packData(address, bigint1, bigint2, bigint3) {
    var numberParam = toUint_8_24_Format(bigint1);
    var secondNumberParam = toUint_8_24_Format(bigint2);
    var thirdNumberParam = toUint_8_24_Format(bigint3);
    return (
      "0x" +
      Buffer.from(
        Uint8Array.from(
          Buffer.from(
            numberParam +
              secondNumberParam +
              thirdNumberParam +
              address.replace("0x", ""),
            "hex"
          )
        )
      ).toString("hex")
    );
  }

  module.exports = {
    toUint_8_24_Format,
    packData

  };