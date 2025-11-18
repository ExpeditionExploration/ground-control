import { useEffect, useState } from 'react';
import { SunIcon } from 'lucide-react';
import { cn } from 'src/client/utility';
import { Switch } from '@headlessui/react';
import { LightColor } from '../types';

export const LightItem: React.FC<{
    color?: LightColor;
    name?: string;
    intensity: number;  // Intensity is displayed value.
    setLight: (brightness: number) => Promise<void>;
}> = ({ color = LightColor.Yellow, name = '', intensity, setLight }) => {
    const modes = 5;

    const calculateBrightness = (intensity: number) => {
        const clamped = Math.min(Math.max(intensity, 0), 1);
        const decrement = 1 / (modes - 1);
        const newIntensity = ((clamped - decrement) < 0) ? 1 : (clamped - decrement);
        setLight(newIntensity);
    }

    return (
        <Switch
            checked={intensity > 0}
            onChange={() => {calculateBrightness(intensity)}}
            className={cn(
                {
                    'data-[checked]:bg-blue-600 !border-blue-300':
                        intensity > 0 && color === LightColor.Blue,
                    'data-[checked]:bg-yellow-600 !border-yellow-300':
                        intensity > 0 && color === LightColor.Yellow,
                    'data-[checked]:bg-red-600  !border-red-300':
                        intensity > 0 && color === LightColor.Red,
                    'bg-gray-200 hover:bg-blue-600': intensity === 0 && color === LightColor.Blue,
                    'bg-gray-200 hover:bg-yellow-600': intensity === 0 && color === LightColor.Yellow,
                    'bg-gray-200 hover:bg-red-600': intensity === 0 && color === LightColor.Red,
                },
                'group flex h-6 relative border-2 border-white w-14 bg-transparent items-center rounded-full transition',
            )}
            title={`Adjust ${name}`}
        >
            <span className="w-full relative flex items-center px-0 text-[0.6rem]">
                <div className="absolute flex items-center space-x-1 left-1 opacity-100">
                    <SunIcon
                        size={10}
                        className="shrink-0 transition group-data-[checked]:translate-x-8"
                    />{' '}
                    <span className="group-data-[checked]:opacity-0">
                        {name}
                    </span>
                </div>
                <div className="absolute left-1 opacity-0 font-bold transition group-data-[checked]:opacity-100">
                    {(intensity * 100).toFixed(0)}%
                </div>
            </span>
        </Switch>
    );
};
