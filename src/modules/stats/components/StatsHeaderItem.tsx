// import { useEvents } from 'src/client/hooks';
import { ViewProps } from 'src/client/user-interface';
import { type StatsModuleClient } from '../client';
import { useEffect, useState } from 'react';
import { Stats } from '../types';
import { Cpu, HardDrive, MemoryStick, Thermometer } from 'lucide-react';
import { cn } from 'src/client/utility';

export const StatsHeaderItem: React.FC<ViewProps<StatsModuleClient>> = ({
    module,
}) => {
    const [stats, setStats] = useState<Stats>({
        temperature: 0,
        cpu: 0,
        memory: 0,
        storage: 0,
    });
    useEffect(() => {
        module.on<Stats>('stats', (data) => {
            setStats(data);
        });
    }, []);

    return (
        <div>
            <div className="grid grid-rows-2 grid-cols-2 gap-1">
                <StatItem
                    title="CPU"
                    icon={Cpu}
                    warnAt={90}
                    value={stats.cpu}
                    symbol="%"
                ></StatItem>
                <StatItem
                    title="Memory"
                    icon={MemoryStick}
                    warnAt={90}
                    value={stats.memory}
                    symbol="%"
                ></StatItem>
                <StatItem
                    title="Temperature"
                    icon={Thermometer}
                    warnAt={80}
                    value={stats.temperature}
                    symbol="°"
                ></StatItem>
                <StatItem
                    title="Storage"
                    icon={HardDrive}
                    warnAt={90}
                    value={stats.storage}
                    symbol="%"
                ></StatItem>
            </div>
        </div>
    );
};

interface StatValueProps {
    warnAt?: number;
    value: number;
    symbol?: string;
    title?: string;
    icon?: any;
}
const StatItem: React.FC<StatValueProps> = ({
    icon: Icon,
    symbol,
    value,
    warnAt = 0,
    title,
}) => (
    <div
        title={title}
        className={cn(
            'flex space-x-2 px-1 w-16 rounded-full justify-center items-center duration-500 transition-colors',
            {
                'bg-red-500': value && value > warnAt,
            },
        )}
    >
        <Icon className="w-4" />
        <div className="text-xs font-bold font-mono">
            <span>{value.toFixed(0)}</span>
            <span>{symbol}</span>
        </div>
    </div>
);
