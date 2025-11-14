// The controller should be exported as a namespaced object.
import { StatsModuleServer } from './stats/server';
import { MediaModuleServer } from './media/server';
// import { LightsModuleServer } from './lights/server';
import { ControlModuleServer } from './control/server';
// import { AngleModuleServer } from './angle/server';
import { SpatialModuleServer } from './spatial/server';
import { IMUModuleServer } from './imu/server';
// import { BatteryModuleServer } from './battery/server';
// import { TOFModuleServer } from './tof/server';

export const modules = new Map([
    ['stats', StatsModuleServer],
    ['media', MediaModuleServer],
    // ['lights', LightsModuleServer],
    ['control', ControlModuleServer],
    ['imu', IMUModuleServer],
    // ['angle', AngleModuleServer],
    ['spatial', SpatialModuleServer],
    // ['battery', BatteryModuleServer],
    // ['tof', TOFModuleServer],
]);
