import { TrapezoidalIntegrator } from './TrapezoidalIntegrator.js'

export class TriAxisIntegrator {
    private x = new TrapezoidalIntegrator()
    private y = new TrapezoidalIntegrator()
    private z = new TrapezoidalIntegrator()

    integrate(value: [number, number, number], timestamp: number): [number, number, number] {
        return [
            this.x.integrate(value[0], timestamp),
            this.y.integrate(value[1], timestamp),
            this.z.integrate(value[2], timestamp),
        ]
    }
}
