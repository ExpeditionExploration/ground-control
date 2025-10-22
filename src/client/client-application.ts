import { Application } from "src/application";
import { Config } from "src/config";
import { Connection } from "src/connection";
import { ModuleLoader } from "src/module-loader";
import { modules } from 'src/modules/client';
import { UserInterfaceLoader } from "./user-interface-loader";
import { ClientApplicationDependencies } from "./client";
import { Container } from "src/container";

export class ClientApplication extends Application {
    private readonly config!: Config;
    private readonly connection!: Connection;
    private readonly moduleLoader!: ModuleLoader;
    private readonly userInterfaceLoader!: UserInterfaceLoader;

    constructor(deps: ClientApplicationDependencies) {
        super();
        this.config = deps.config;
        this.connection = deps.connection;
        this.moduleLoader = deps.moduleLoader;
        this.userInterfaceLoader = deps.userInterfaceLoader;
    }

    async init(container: Container) {
        await Promise.all([
            this.config.init(),
            this.moduleLoader.init(modules, container),
        ]);

        await this.moduleLoader.loadModules();
        await this.userInterfaceLoader.init();

        await this.connection.init();
    }

    destroy() {
        console.log('Destroying client application');
        this.connection.destroy();
    }
}

export default ClientApplication;