// The controller should be exported as a namespaced object.
import { StatsModuleClient } from './stats/client';
import { MediaModuleClient } from './media/client';
import { AngleModuleClient } from './angle/client';
import { ControlModuleClient } from './control/client';
import { SpatialModuleClient } from './spatial/client';
import { BatteryModuleClient } from './battery/client';
import { LightsModuleClient } from './lights/client';
import { TOFModuleClient } from './tof/client';

export const modules = new Map([
    ['spatial', SpatialModuleClient],   
    ['stats', StatsModuleClient],
    ['media', MediaModuleClient],
    ['angle', AngleModuleClient],
    ['control', ControlModuleClient],
    ['battery', BatteryModuleClient],
    ['lights', LightsModuleClient],
    ['tof', TOFModuleClient],
]);
