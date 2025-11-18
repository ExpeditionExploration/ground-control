// import { useEvents } from 'src/client/hooks';
import { ViewProps } from 'src/client/user-interface';
import { type LightsModuleClient } from '../client';
import { LightItem } from './LightItem';
import { LightColor } from '../types';
import { SetLightRequest, LightStatusUpdate } from '../types';
import { useEffect, useState } from 'react';

export const LightingGridController: React.FC<
    ViewProps<LightsModuleClient>
> = ({ module }) => {

    const [irIntensity, setIrIntensity] = useState(0);
    const [uvIntensity, setUvIntensity] = useState(0);
    const [visIntensity, setVisIntensity] = useState(0);

    // Subscribe to light status updates
    useEffect(() => {
        module.on<LightStatusUpdate>('lightStatus', (data) => {
            switch (data.command) {
                case 'infrared-led':
                    setIrIntensity(data.intensity);
                    break;
                case 'ultraviolet-led':
                    setUvIntensity(data.intensity);
                    break;
                case 'visible-led':
                    setVisIntensity(data.intensity);
                    break;
            }
        });
    }, []);

    const setBrightnessPartial = (command: 'visible-led' | 'infrared-led' | 'ultraviolet-led') => {
        return (brightness: number) => module.setLight({command, intensity: brightness});
    }

    return (
        <div className="relative h-14 flex flex-col gap-1 justify-center items-end">
            <LightItem intensity={visIntensity} setLight={setBrightnessPartial('visible-led')} color={LightColor.Yellow} name="Vis" />
            <LightItem intensity={irIntensity} setLight={setBrightnessPartial('infrared-led')} color={LightColor.Red} name="IR" />
            <LightItem intensity={uvIntensity} setLight={setBrightnessPartial('ultraviolet-led')} color={LightColor.Blue} name="UV" />
        </div>
    );
};
