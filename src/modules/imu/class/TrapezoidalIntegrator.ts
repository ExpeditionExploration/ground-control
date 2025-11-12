
export class TrapezoidalIntegrator {
    private lastValue?: number
    private previousTimestamp?: number

    integrate(value: number, timestamp: number): number {
        let result = 0
        if (this.lastValue !== undefined) {
            const min = Math.min(this.lastValue, value)
            const max = Math.max(this.lastValue, value)
            result = ((min) + ((max - min) * 0.5)) * (timestamp - this.previousTimestamp) / 1000
        }
        this.lastValue = value
        this.previousTimestamp = timestamp
        return result
    }
}
