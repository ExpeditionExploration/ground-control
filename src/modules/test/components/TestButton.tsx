// import { useEvents } from 'src/client/hooks';
import { ViewProps } from 'src/client/user-interface';
import { type TestModuleClient } from '../client';
import { Rotate3D } from 'lucide-react';

export const TestButton: React.FC<
    ViewProps<TestModuleClient>
> = ({ module }) => {
    return (
        <div
            onClick={() => {
                module.openWindow();
            }}
            className="rounded-full w-14 h-14 flex border-2 border-white justify-center items-center transition-colors cursor-pointer hover:bg-emerald-600"
        >
            <Rotate3D className="size-6" />
        </div>
    );
};
