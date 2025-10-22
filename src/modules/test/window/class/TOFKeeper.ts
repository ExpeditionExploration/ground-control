import * as THREE from "three"
import { ScanData } from "vl53l5cx/dist/types";


// Change to change ToF sensor default orientation relative to the drone
const tofSettings = {
    orientationCorrectionEnabled: true,
    orientationCorrection: {
        yaw: 0,
        pitch: -90,
        roll: 90
    },
    mirrorAxis: {
        yaw: false,
        pitch: false,
        roll: true
    }
}

const deg2rad = (deg: number): number => {
    return deg * (Math.PI / 180)
}


export class TOFKeeper {
    private drone: THREE.Group<THREE.Object3DEventMap>
    private meshArray: THREE.Mesh[] = Array(64).fill(null)
    private scene: THREE.Scene

    constructor(drone: THREE.Group<THREE.Object3DEventMap>, scene: THREE.Scene) {
        this.drone = drone
        this.scene = scene
    }

    /**
     * Computes the direction vector for a given zone (x, y) in the ToF sensor grid.
     * @param x Zone x index (0-7, left to right)
     * @param y Zone y index (0-7, top to bottom)
     * @returns THREE.Vector3 direction in local sensor space
     */
    private getZoneDirection(x: number, y: number): THREE.Vector3 {
        // FOV is 45deg (horizontal/vertical), 8x8 grid
        const FOV_RAD = Math.PI / 4 // 45deg
        const ZONES = 8
        const CENTER = (ZONES - 1) / 2 // 3.5
        const ANGLE_PER_ZONE = FOV_RAD / ZONES
        // Offset from center in radians
        const theta_x = (x - CENTER) * ANGLE_PER_ZONE
        const theta_y = (y - CENTER) * ANGLE_PER_ZONE
        // In sensor local space: Z is forward, X is right, Y is down
        // We'll use Y up, so flip sign for y
        let dir = new THREE.Vector3(
            Math.tan(theta_x),
            -Math.tan(theta_y),
            1
        )
        dir = dir.normalize()
        
        if (tofSettings.orientationCorrectionEnabled) {
            // Apply orientation correction
            const pitch = deg2rad(tofSettings.orientationCorrection.pitch)
            const yaw = deg2rad(tofSettings.orientationCorrection.yaw)
            const roll = deg2rad(tofSettings.orientationCorrection.roll)
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, "YXZ"))
            dir.applyQuaternion(q)
        
            if (tofSettings.mirrorAxis.pitch || tofSettings.mirrorAxis.yaw || tofSettings.mirrorAxis.roll) {
                // Apply mirroring based on settings
                // Note: this assumes the mirroring is applied in the same order as the axes
                // and that the mirroring is symmetric across the origin.
                dir = new THREE.Vector3(
                    dir.x * (tofSettings.mirrorAxis.pitch ? -1 : 1),
                    dir.y * (tofSettings.mirrorAxis.yaw ? -1 : 1),
                    dir.z * (tofSettings.mirrorAxis.roll ? -1 : 1))
            }
        }
        return dir
    }

    /**
     * Returns a MeshStandardMaterial with opacity falling off (quadratically) as distance grows.
     */
    private createToFMaterial(distance_mm: number): THREE.MeshStandardMaterial {
        const minDist = 100;   // mm
        const maxDist = 4000;  // mm
        const f = (x: number) => 1 / (Math.pow(x, 2));
        const unreliability = Math.min(1, Math.max(0, (f(distance_mm) - f(minDist)) / (f(maxDist) - f(minDist))));
        const reliability = 1 - unreliability;
        const color = new THREE.Color(1, 1, 1);
        return new THREE.MeshStandardMaterial({ color, transparent: true, opacity: Math.max(reliability, 0.1) });
    }

    /**
     * Resizes the mesh at the given scan zone index to match the new distance
     * (updates sphere radius).
     * @param scanZoneNdx Index of the zone (0-63)
     * @param distance_mm New distance in millimeters
     */
    private resizeMesh(scanZoneNdx: number, distance_mm: number): void {
        const mesh = this.meshArray[scanZoneNdx]
        if (!mesh) return
        // Calculate new zone width (diameter in mm)
        const zone_width = this.getZoneSize(distance_mm)
        // Update geometry: replace with new sphere geometry
        const newGeometry = new THREE.SphereGeometry(zone_width / 2.0 / 1000.0)
        mesh.geometry.dispose()
        mesh.geometry = newGeometry
    }

    private displaceMesh(scanZoneNdx: number, distance_mm: number) {
        const y = Math.floor(scanZoneNdx / 8)
        const x = scanZoneNdx % 8

        // Use getZoneDirection for this zone
        const localDir = this.getZoneDirection(x, y)
        // Transform to world space using drone orientation
        const worldDir = localDir.clone().applyQuaternion(this.drone.quaternion)
        // Offset by distance (in meters)
        const offset = worldDir.multiplyScalar(distance_mm / 1000.0)
        // Add to drone's world position
        const worldPos = this.drone.getWorldPosition(new THREE.Vector3()).add(offset)
        const mesh = this.meshArray[scanZoneNdx]
        if (mesh) {
            mesh.position.set(worldPos.x, worldPos.y, worldPos.z);
            mesh.material = this.createToFMaterial(distance_mm);
        }
    }

    private getZoneSize(distance_mm: number): number {
        const fov = Math.PI * 0.25 // 45 degrees
        const sector_width = Math.tan(0.5 * fov) * distance_mm * 2
        return sector_width / 8.0 // Zones are square
    }

    private createMesh(distance_mm: number): THREE.Mesh {
        const zone_width = this.getZoneSize(distance_mm)
        const geometry = new THREE.SphereGeometry(zone_width/2.0/1000.0)
        const material = this.createToFMaterial(distance_mm)
        const mesh = new THREE.Mesh(geometry, material)
        this.scene.add(mesh)
        return mesh
    }

    update(data: ScanData) {
        for (let i = 0; i < data.scanZones.length; i++) {
            const distance_mm = data.scanZones[i]?.distanceMillimeters
            if (typeof distance_mm !== 'number' || distance_mm <= 0) continue
            if (!this.meshArray[i]) {
                const mesh = this.createMesh(distance_mm)
                this.meshArray[i] = mesh
            } else {
                this.resizeMesh(i, distance_mm)
            }
            this.displaceMesh(i, distance_mm)
        }
    }
}
