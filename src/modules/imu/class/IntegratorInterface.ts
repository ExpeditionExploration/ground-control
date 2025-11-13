
export interface IntegratorInterface {
    integrate: (value: [number, number, number], timestamp: number) => [number, number, number];
};