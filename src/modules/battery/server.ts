import { Module } from 'src/module';
import { BatteryStatus } from './types';
import {
    type INA226, INA226ConversionTime, INA226AverageMode, INA226Mode, bindings
} from 'openi2c-ina226';
import {
    batteryCurrentGraphDataPointInterval,
} from './components/constants';
import { ServerModuleDependencies } from 'src/server/server';

class INA226CurrentSensor {
    private ina226: INA226;

    constructor(
        i2cBus: number, address: number, shuntResistance: number,
        shuntConversionTime: INA226ConversionTime = INA226ConversionTime.CONVERSION_TIME_1P1_MS,
        busConversionTime: INA226ConversionTime = INA226ConversionTime.CONVERSION_TIME_1P1_MS,
        averageMode: INA226AverageMode = INA226AverageMode.AVERAGE_16,
        mode: INA226Mode = INA226Mode.SHUNT_AND_BUS_CONTINUOUS
    ) {
        this.ina226 = bindings;
        this.ina226.init(
            i2cBus, address, shuntResistance,
            shuntConversionTime, busConversionTime,
            averageMode, mode
        );
    }

    getCurrent(): number {
        return this.ina226.getCurrent();
    }
}

export class BatteryModuleServer extends Module {
    // 2550 mAh cells for 2S3P battery for a nominal voltage of 7.4V.
    battery: Battery
    batteryVoltageSetter = new BatteryLevelSetter(defaultChargeLevelFunction);
    private statusInterval?: NodeJS.Timeout;
    private currentSensor?: INA226CurrentSensor;

    constructor(deps: ServerModuleDependencies) {
        super(deps);
    }

    async onModuleInit() {
        this.battery = new Battery(
            this.config.modules.battery.server.cellCapacity,
            this.config.modules.battery.server.cellsInSeries,
            this.config.modules.battery.server.cellsInParallel
        );
        this.simulateBatteryVoltageCheck();
        if (this.config.modules.battery.server.simulated) {
            //this.logger.info('Battery module is running in simulated mode.');
            return;
        }
        this.currentSensor = new INA226CurrentSensor(
            this.config.modules.battery.server.ina226.i2cBus,
            parseInt(this.config.modules.battery.server.ina226.i2cAddr, 16),
            this.config.modules.battery.server.ina226.shuntResistorOhms,
            INA226ConversionTime.CONVERSION_TIME_1P1_MS,
            INA226ConversionTime.CONVERSION_TIME_1P1_MS,
            INA226AverageMode.INA226_AVG_16,
            INA226Mode.SHUNT_BUS_VOLTAGE_CONTINUOUS
        );

    }

    simulateBatteryVoltageCheck() {
        if (this.statusInterval) return;
        this.statusInterval = setInterval(() => {
            const currentDraw = this.currentSensor?.getCurrent() ?? Math.random() * 2000 + 2000;
            this.battery.recordConsumption(currentDraw);
            this.emit<BatteryStatus>('status', {
                level: this.battery.getBatteryLevelPercentage() * 100,
                minutesRemaining: this.battery.getEstimatedTimeRemaining(),
                currentDraw: currentDraw,
            });
        }, batteryCurrentGraphDataPointInterval);
    }
}

/**
 * Function type to convert voltage to charge level percentage.
 */
type chargeLevelFunction = (voltage: number) => number;

/**
 * Default function to convert voltage to charge level percentage.
 * 
 * Source: https://www.dnkpower.com/wp-content/uploads/2022/09/Panasonic-UR18650ZTA-Datasheet.pdf
 *
 * Taken from the discharge curve at 0°C at 1C rate (2850mA).
 * 
 * @param voltage - Voltage of the battery
 * @returns Charge level in mAs (milli ampere seconds)
 */
const defaultChargeLevelFunction: chargeLevelFunction = (voltage: number) => {
    if (voltage >= 3.8) return 9180000; // 2550mAh * 3600 = 9180000
    if (voltage >= 3.75) return 8820000 // 2450mAh as mAs
    if (voltage >= 3.7) return  8460000 // 2350mAh * 3600;
    if (voltage >= 3.65) return 7200000 // 2000mAh * 3600;
    if (voltage >= 3.6) return 6660000 // 1850mAh * 3600;
    if (voltage >= 3.55) return 5940000 // 1650mAh * 3600;
    if (voltage >= 3.5) return 5040000 // 1400mAh * 3600;
    if (voltage >= 3.45) return 4500000 // 1250mAh * 3600;
    if (voltage >= 3.4) return 3240000 // 900mAh * 3600;
    if (voltage >= 3.35) return 2520000 // 700mAh * 3600;
    if (voltage >= 3.3) return 1980000 // 550mAh * 3600;
    if (voltage >= 3.25) return 1260000 // 350mAh * 3600;
    if (voltage >= 3.2) return 900000 // 250mAh * 3600;
    if (voltage >= 3.15) return 720000; // 200mAh * 3600;
    if (voltage >= 3.1) return 360000; // 100mAh * 3600; ~4% remaining
    if (voltage >= 3.05) return 180000; // 50mAh * 3600; ~2% remaining
    return 0; // 0% remaining
}

/**
 * Class to set battery level based on voltage using a provided function.
 */
class BatteryLevelSetter {
    private chargeLevelFunction: chargeLevelFunction;

    constructor(chargeLevelFunction: chargeLevelFunction) {
        this.chargeLevelFunction = chargeLevelFunction;
    }

    setBatteryLevel(voltage: number, battery: Battery) {
        const charge = this.chargeLevelFunction(voltage);
        battery.setCurrentCapacity(charge);
    }
}

type ConsumptionRecord = {
    timestamp: number;
    /**
     * Current in mA
     */
    current: number;
};

/**
 * Battery class to track capacity, consumption history, and estimate remaining time.
 */
class Battery {
    private totalCapacity: number; // in mAs
    private remainingCapacity: number; // in mAs
    private history: ConsumptionRecord[] = [];
    private maxHistoryLength: number;
    private cellsInSeries: number;
    private cellsInParallel: number;

    /**
     * @param cellCapacity - Capacity of the cellCapacity in mAh
     * @param S - Number of cells in series
     * @param P - Number of cells in parallel
     * @param maxHistoryLength - Maximum length of the consumption history
     */
    constructor(
        cellCapacity: number,
        S: number,
        P: number,
        maxHistoryLength: number = 60) {
        this.totalCapacity = cellCapacity * P * 3600; // Convert mAh to mAs
        this.remainingCapacity = this.totalCapacity;
        this.maxHistoryLength = maxHistoryLength;
        this.cellsInSeries = S;
        this.cellsInParallel = P;
    }

    /**
     * @returns Current battery level in Ah
     */
    getBatteryLevel(): number {
        return this.remainingCapacity;
    }

    /**
     * @returns Current battery level as a percentage (0.0 to 1.0)
     */
    getBatteryLevelPercentage(): number {
        return this.remainingCapacity / this.totalCapacity;
    }

    /**
     * Sets the current battery capacity.
     * @param cellCharge - Individual cell charge in mAs as given by a `chargeLevelFunction`.
     */
    setCurrentCapacity(cellCharge: number) {
        this.remainingCapacity = cellCharge * this.cellsInParallel;
    }

    /**
     * Records the battery consumption as current measurement.
     * @param consumption - Consumption in mA
     */
    recordConsumption(consumptionMilliAmps: number) {
        const now = Date.now();
        // store current in mA
        this.history.push({ timestamp: now, current: consumptionMilliAmps });
        if (this.history.length > this.maxHistoryLength) {
            this.history.shift();
        }
    }

    /**
     * @returns Time-weighted average current draw consumption in mA
     */
    getAverageConsumption(): number {
        if (this.history.length < 2) {
            return 0;
        }

        // Compute time-weighted average: avgA = sum(I_i * dt_i) / sum(dt_i)
        let weightedSum = 0; // A * s
        let totalTime = 0; // s
        for (let i = 1; i < this.history.length; i++) {
            const prev = this.history[i - 1];
            const curr = this.history[i];
            const dt = (curr.timestamp - prev.timestamp) * 0.001; // seconds
            if (dt <= 0) continue;
            // assume draw during interval equals previous sample current
            weightedSum += prev.current * dt;
            totalTime += dt;
        }
        if (totalTime === 0) return 0;
        return weightedSum / totalTime; // mA
    }

    /**
     * @returns Estimated time remaining in minutes
     */
    getEstimatedTimeRemaining(): number {
        const avgConsumption = this.getAverageConsumption();
        if (avgConsumption === 0) return Infinity;
        const minutes = this.remainingCapacity / avgConsumption / 60;
        return minutes;
    }
}
