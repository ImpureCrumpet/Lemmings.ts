
export interface IOpl3 {
    generate(lenSamples: number): Int16Array;
    write(reg: number, val: number): void;
}
