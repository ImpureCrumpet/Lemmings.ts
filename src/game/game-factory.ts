import { GameConfig } from './config/game-config';
import { Game } from './game';
import { GameResources } from './game-resources';
import { GameTypes } from './game-types';
import { FileProvider } from './resources/file/file-provider';
import type {
    ResourceDataSource,
    ResourceDataSourceResolver,
} from './resources/file/resource-data-source';
import { ConfigReader } from './utilities/config-reader';

/** loads the config and provides an game-resources object */
export class GameFactory {

    private configReader: ConfigReader;
    private fileProvider: FileProvider;
    private dataSourceResolver: ResourceDataSourceResolver;

    constructor(private rootPath: string, dataSourceResolver?: ResourceDataSourceResolver) {
        this.fileProvider = new FileProvider(rootPath);
        this.dataSourceResolver = dataSourceResolver ?? {
            resolve: (): ResourceDataSource => this.fileProvider,
        };

        const configFileReader = this.fileProvider.loadString('config.json');
        this.configReader = new ConfigReader(configFileReader);
    }


    /** return a game object to control/run the game */
    public async getGame(gameType: GameTypes, levelGroupIndex: number, levelIndex: number): Promise<Game | undefined> {

        /// load resources
        const res = await this.getGameResources(gameType);
        if (!res) {
            return;
        }

        return Game.loadLevel(res, levelGroupIndex, levelIndex);

    }

    /** return the config of a game type */
    public getConfig(gameType: GameTypes): Promise<GameConfig | undefined> {
        return this.configReader.getConfig(gameType);
    }

    /** return a Game Resources that gave access to images, maps, sounds  */
    public async getGameResources(gameType: GameTypes): Promise<GameResources | undefined> {

        const config = await this.configReader.getConfig(gameType);

        if (!config) {
            return;
        }

        return new GameResources(this.dataSourceResolver.resolve(config.path), config);



    }
}
