import { Module } from 'src/module';
import { UserInterface } from 'src/client/user-interface';
import { ClientModuleDependencies } from 'src/client/client';
import { Wrench } from './types';

export class ControlModuleClient extends Module {
    userInterface: UserInterface;
    private pollHandle?: number;
    private lastWrench: Wrench = { heave: 0, sway: 0, surge: 0, yaw: 0, pitch: 0, roll: 0 };
    // Added keyboard state
    private keyState = {
        w: false,
        a: false,
        s: false,
        d: false,
        e: false,
        c: false,
        ArrowUp: false,
        ArrowDown: false,
        ArrowLeft: false,
        ArrowRight: false
    };

    private updateWrenchFromInputs = (lx: number, ly: number, rx: number, ry: number, heave?: number) => {
        const round = (v: number) => Math.round(v * 100) / 100;

        const next: Wrench = { heave: heave ?? 0, sway: 0, surge: round(-ly), yaw: round(lx), pitch: round(-ry), roll: round(rx) };

        // Change detection to reduce chatter
        if (Object.keys(next).some(k => (next as any)[k] !== (this.lastWrench as any)[k])) {
            this.lastWrench = next;
            this.emit<Wrench>('wrenchTarget', next);
        }
    };

    private pollGamepad = () => {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gamepad = Array.from(pads).find(p => !!p && p.axes.length >= 4);

        // Defaults (neutral)
        let lx = 0, ly = 0, rx = 0, ry = 0, heave = 0;

        if (gamepad) {
            if (gamepad.axes.length >= 2) {
                lx = gamepad.axes[0]; // yaw
                ly = gamepad.axes[1]; // throttle
            }
            if (gamepad.axes.length >= 4) {
                rx = gamepad.axes[2]; // roll
                ry = gamepad.axes[3]; // pitch
            }
            if (gamepad.buttons[12] && gamepad.buttons[12].pressed) {
                // D-pad up, Heave up
                heave = 1;
            }
            if (gamepad.buttons[13] && gamepad.buttons[13].pressed) {
                // D-pad down, Dive deeper
                heave = -1;
            }
        }

        // Override with keyboard state
        if (this.keyState.w || this.keyState.s) {
            ly = this.keyState.w && this.keyState.s ? 0 : (this.keyState.w ? -1 : 1);
        }
        if (this.keyState.a || this.keyState.d) {
            lx = this.keyState.a && this.keyState.d ? 0 : (this.keyState.a ? -1 : 1);
        }
        if (this.keyState.ArrowUp || this.keyState.ArrowDown) {
            ry = this.keyState.ArrowUp && this.keyState.ArrowDown ? 0 : (this.keyState.ArrowUp ? -1 : 1);
        }
        if (this.keyState.ArrowLeft || this.keyState.ArrowRight) {
            rx = this.keyState.ArrowLeft && this.keyState.ArrowRight ? 0 : (this.keyState.ArrowLeft ? -1 : 1);
        }
        if (this.keyState.e || this.keyState.c) {
            heave = this.keyState.e ? 1 : (this.keyState.c ? -1 : 0);
        }

        this.updateWrenchFromInputs(lx, ly, rx, ry, heave);
    };

    private keyDownHandler = (e: KeyboardEvent) => {
        switch (e.key) {
            case 'w': case 'W': this.keyState.w = true; break;
            case 'a': case 'A': this.keyState.a = true; break;
            case 's': case 'S': this.keyState.s = true; break;
            case 'd': case 'D': this.keyState.d = true; break;
            case 'e': case 'E': this.keyState.e = true; break;
            case 'c': case 'C': this.keyState.c = true; break;
            case 'ArrowUp': this.keyState.ArrowUp = true; break;
            case 'ArrowDown': this.keyState.ArrowDown = true; break;
            case 'ArrowLeft': this.keyState.ArrowLeft = true; break;
            case 'ArrowRight': this.keyState.ArrowRight = true; break;
            default: return;
        }
        
        // Compute current keyboard state immediately (no gamepad polling)
        let lx = 0, ly = 0, rx = 0, ry = 0, heave = 0;
        
        if (this.keyState.w || this.keyState.s) {
            ly = this.keyState.w && this.keyState.s ? 0 : (this.keyState.w ? -1 : 1);
        }
        if (this.keyState.a || this.keyState.d) {
            lx = this.keyState.a && this.keyState.d ? 0 : (this.keyState.a ? -1 : 1);
        }
        if (this.keyState.ArrowUp || this.keyState.ArrowDown) {
            ry = this.keyState.ArrowUp && this.keyState.ArrowDown ? 0 : (this.keyState.ArrowUp ? -1 : 1);
        }
        if (this.keyState.ArrowLeft || this.keyState.ArrowRight) {
            rx = this.keyState.ArrowLeft && this.keyState.ArrowRight ? 0 : (this.keyState.ArrowLeft ? -1 : 1);
        }
        if (this.keyState.e || this.keyState.c) {
            heave = this.keyState.e ? 1 : (this.keyState.c ? -1 : 0);
        }
        
        this.updateWrenchFromInputs(lx, ly, rx, ry, heave);
    };

    private keyUpHandler = (e: KeyboardEvent) => {
        switch (e.key) {
            case 'w': case 'W': this.keyState.w = false; break;
            case 'a': case 'A': this.keyState.a = false; break;
            case 's': case 'S': this.keyState.s = false; break;
            case 'd': case 'D': this.keyState.d = false; break;
            case 'e': case 'E': this.keyState.e = false; break;
            case 'c': case 'C': this.keyState.c = false; break;
            case 'ArrowUp': this.keyState.ArrowUp = false; break;
            case 'ArrowDown': this.keyState.ArrowDown = false; break;
            case 'ArrowLeft': this.keyState.ArrowLeft = false; break;
            case 'ArrowRight': this.keyState.ArrowRight = false; break;
            default: return;
        }
        
        // Compute current keyboard state immediately (no gamepad polling)
        let lx = 0, ly = 0, rx = 0, ry = 0, heave = 0;
        
        if (this.keyState.w || this.keyState.s) {
            ly = this.keyState.w && this.keyState.s ? 0 : (this.keyState.w ? -1 : 1);
        }
        if (this.keyState.a || this.keyState.d) {
            lx = this.keyState.a && this.keyState.d ? 0 : (this.keyState.a ? -1 : 1);
        }
        if (this.keyState.ArrowUp || this.keyState.ArrowDown) {
            ry = this.keyState.ArrowUp && this.keyState.ArrowDown ? 0 : (this.keyState.ArrowUp ? -1 : 1);
        }
        if (this.keyState.ArrowLeft || this.keyState.ArrowRight) {
            rx = this.keyState.ArrowLeft && this.keyState.ArrowRight ? 0 : (this.keyState.ArrowLeft ? -1 : 1);
        }
        if (this.keyState.e || this.keyState.c) {
            heave = this.keyState.e ? 1 : (this.keyState.c ? -1 : 0);
        }
        
        this.updateWrenchFromInputs(lx, ly, rx, ry);
    };

    constructor(deps: ClientModuleDependencies) {
        super(deps);
        this.userInterface = deps.userInterface;
    }

    onModuleInit(): void | Promise<void> {
        // Register keyboard listeners
        window.addEventListener('keydown', this.keyDownHandler);
        window.addEventListener('keyup', this.keyUpHandler);

        // Regular polling for gamepad updates (includes keyboard overrides)
        this.pollHandle = window.setInterval(this.pollGamepad, 250); // 50Hz
    }

    onModuleDestroy(): void {
        if (this.pollHandle) {
            clearInterval(this.pollHandle);
            this.pollHandle = undefined;
        }
        // Remove keyboard listeners
        window.removeEventListener('keydown', this.keyDownHandler);
        window.removeEventListener('keyup', this.keyUpHandler);
    }
}
