import { Module } from "src/module";
import { ApplicationDependencies, Container } from "src/container";
import { asClass, asValue, AwilixContainer } from 'awilix';

type ModuleNamespace = string;
type ModuleConstructor = new (...args: any[]) => Module;
export type ModulesImport = Map<ModuleNamespace, ModuleConstructor>;
export type ModuleDependencies = {
    namespace: string;
    module: Module;
} & ApplicationDependencies;
export type ModuleContainers = AwilixContainer<ModuleDependencies>[];

export class ModuleLoader {
    modules: ModuleContainers = [];
    async init(modules: ModulesImport, container: Container) {
        // Create modules containers
        this.modules = this.loadModulesIntoContainer(container, modules);
    }

    private reservedKeys = ['default', 'app', 'root', 'event'];
    private loadModulesIntoContainer(container: Container, modules: ModulesImport): ModuleContainers {
        const modulesMap: ModuleContainers = [];
        // Load modules in reverse order to ensure correct display order
        for (const [namespace, SubClassedModule] of Array.from(modules.entries())) {
            if (namespace in this.reservedKeys) throw new Error(`Module namespace "${namespace}" is reserved`);

            const moduleContainer = container.createScope<ModuleDependencies>();
            moduleContainer.register({
                'namespace': asValue(namespace),
                'module': asClass<Module>(SubClassedModule).scoped(),
            })
            modulesMap.push(moduleContainer);
        }

        return modulesMap;
    }

    async loadModules() {
        await Promise.all(this.modules.map(async (container) => {
            const instance = container.resolve('module');

            // Delaying the user interface loader initialization to ensure delayed injections
            // are resolved before the module is initialized
            await new Promise<void>((resolve) => setTimeout(async () => {
                await instance.onModuleInit();
                instance.emit('config', instance.config);
                resolve();
            }, 0))
        }));
    }
}