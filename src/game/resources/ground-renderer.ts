import { Frame } from './frame';
import { LevelElement } from './lemmings/level-element';
import { LevelReader } from './lemmings/level-reader';
import { TerrainImageInfo } from './lemmings/terrain-image-info';
import { VgaSpecReader } from './lemmings/vga-spec-reader';


/** uses the LevelReader and GroundReader to render/create the games background */
export class GroundRenderer {

    public img: Frame;

    constructor(img: Frame) {
        this.img = img;
    }

    public static fromVgaSpecMap(lr: LevelReader, vr: VgaSpecReader) {
        return new GroundRenderer(vr.img);
    }


    /** create the ground image from the level definition and the Terrain images */
    public static fromGroundMap(lr: LevelReader, terrainImg: TerrainImageInfo[]) {

        const img = new Frame(lr.levelWidth, lr.levelHeight);

        const terrainObjects: LevelElement[] = lr.terrains;

        for (let i = 0; i < terrainObjects.length; i++) {
            const tOb = terrainObjects[i];

            this.copyImageTo(img, terrainImg[tOb.id], tOb);
        }

        return new GroundRenderer(img);
    }



    /** copy a terrain image to the ground */
    private static copyImageTo(destImg: Frame, srcImg: TerrainImageInfo, destConfig: LevelElement, frameIndex: number = 0) {
        if (!srcImg) {
            return;
        }

        const pixBuf = srcImg.frames[frameIndex];

        const w = srcImg.width;
        const h = srcImg.height;

        const pal = srcImg.palette;

        const destX = destConfig.x;
        const destY = destConfig.y;

        const upsideDown = destConfig.drawProperties.isUpsideDown;
        const noOverwrite = destConfig.drawProperties.noOverwrite;
        const isErase = destConfig.drawProperties.isErase;
        const onlyOverwrite = destConfig.drawProperties.onlyOverwrite;

        for (let y = 0; y < h; y++) {

            for (let x = 0; x < w; x++) {

                const sourceY = upsideDown ? (h - y - 1) : y;

                /// read source color index
                const colorIndex = pixBuf[sourceY * w + x];

                /// ignore transparent pixels
                if ((colorIndex & 0x80) != 0) {
                    continue;
                }


                if (isErase) {
                    destImg.clearPixel(x + destX, y + destY);
                }
                else {
                    destImg.setPixel(x + destX, y + destY, pal.getColor(colorIndex), noOverwrite, onlyOverwrite);
                }
            }
        }

    }

}
