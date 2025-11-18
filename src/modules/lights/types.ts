export type SetLightRequest = {
    intensity: number;
    command: 'visible-led' | 'infrared-led' | 'ultraviolet-led';
};
export type LightStatusUpdate = SetLightRequest;
export enum LightColor {
    Yellow,
    Violet,
    Red,
    Blue,
}

