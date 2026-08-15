import { Level } from '../resources/level';
import { EventHandler } from '../utilities/event-handler';

export interface FrameScheduler {
    requestFrame(callback: (timestamp: number) => void): number;
    cancelFrame(frameId: number): void;
}

const browserFrameScheduler: FrameScheduler = {
    requestFrame: (callback) => globalThis.requestAnimationFrame(callback),
    cancelFrame: (frameId) => globalThis.cancelAnimationFrame(frameId),
};

export class GameTimer {
    readonly TIME_PER_FRAME_MS: number = 60;
    readonly MAX_CATCH_UP_STEPS: number = 5;

    private _speedFactor: number = 1;
    private animationFrameId: number | undefined;
    private running = false;
    private lastFrameTimestamp: number | undefined;
    private accumulatedTimeMs = 0;
    private pageVisible = true;
    private resumeWhenVisible = false;
    private stopped = false;

    /** the current game time in number of steps the game has made  */
    private tickIndex: number = 0;
    private ticksTimeLimit: number;

    constructor(level: Level, private frameScheduler: FrameScheduler = browserFrameScheduler) {
        this.ticksTimeLimit = this.secondsToTicks(level.timeLimit * 60);
    }

    /** return if the game timer is running or not */
    public isRunning(): boolean {
        return this.running;
    }

    /** define a factor to speed up >1 or slow down <1 the game */
    public get speedFactor(): number {
        return this._speedFactor;
    }

    /** set a factor to speed up >1 or slow down <1 the game */
    public set speedFactor(newSpeedFactor: number) {
        if (!Number.isFinite(newSpeedFactor) || newSpeedFactor <= 0) {
            throw new RangeError(`Game speed factor must be greater than zero; received ${newSpeedFactor}`);
        }
        this._speedFactor = newSpeedFactor;
    }

    /** event raising on every tick (one step in time) the game made */
    public onGameTick = new EventHandler<void>();

    /** event raising on before every tick (one step in time) the game made */
    public onBeforeGameTick = new EventHandler<number>();

    /** event raised once per animation frame, after all required logical ticks */
    public onRenderFrame = new EventHandler<void>();

    /** Pause the game */
    public pause() {
        this.resumeWhenVisible = false;
        this.running = false;
        this.cancelScheduledFrame();
    }

    /** Backwards-compatible name for pause. */
    public suspend() {
        this.pause();
    }

    /** End the game */
    public stop() {
        this.pause();
        this.stopped = true;
        this.onBeforeGameTick.dispose();
        this.onGameTick.dispose();
        this.onRenderFrame.dispose();
    }

    /** toggle between suspend and continue */
    public toggle() {
        if (this.isRunning()) {
            this.pause();
        } else {
            this.resume();
        }
    }

    /** Run the game timer */
    public resume() {
        if (this.stopped || this.isRunning()) {
            return;
        }

        if (!this.pageVisible) {
            this.resumeWhenVisible = true;
            return;
        }

        this.running = true;
        this.lastFrameTimestamp = undefined;
        this.scheduleNextFrame();
    }

    /** Backwards-compatible name for resume. */
    public continue() {
        this.resume();
    }

    /** Pause while the page is hidden without creating a catch-up burst on return. */
    public setPageVisible(isVisible: boolean) {
        if (this.pageVisible === isVisible) {
            return;
        }

        this.pageVisible = isVisible;
        if (!isVisible) {
            this.resumeWhenVisible = this.isRunning();
            this.running = false;
            this.cancelScheduledFrame();
            return;
        }

        const shouldResume = this.resumeWhenVisible;
        this.resumeWhenVisible = false;
        if (shouldResume) {
            this.resume();
        }
    }

    /** run the game one step in time */
    public tick() {
        if (this.onBeforeGameTick != null) this.onBeforeGameTick.trigger(this.tickIndex);
        this.tickIndex++;
        if (this.onGameTick != null) this.onGameTick.trigger();
    }

    private scheduleNextFrame() {
        this.animationFrameId = this.frameScheduler.requestFrame((timestamp) => {
            this.processFrame(timestamp);
        });
    }

    private cancelScheduledFrame() {
        if (this.animationFrameId !== undefined) {
            this.frameScheduler.cancelFrame(this.animationFrameId);
        }
        this.animationFrameId = undefined;
        this.lastFrameTimestamp = undefined;
    }

    private processFrame(timestamp: number) {
        if (!this.isRunning()) {
            return;
        }

        this.animationFrameId = undefined;

        if (this.lastFrameTimestamp !== undefined) {
            const elapsedTimeMs = Math.max(0, timestamp - this.lastFrameTimestamp) * this._speedFactor;
            const maximumAccumulatedTime = this.TIME_PER_FRAME_MS * this.MAX_CATCH_UP_STEPS;
            this.accumulatedTimeMs = Math.min(
                this.accumulatedTimeMs + elapsedTimeMs,
                maximumAccumulatedTime,
            );

            const roundingToleranceMs = 0.000_001;
            while (this.accumulatedTimeMs + roundingToleranceMs >= this.TIME_PER_FRAME_MS) {
                this.accumulatedTimeMs -= this.TIME_PER_FRAME_MS;
                this.tick();

                if (!this.running) {
                    break;
                }
            }
        }

        if (this.running) {
            this.lastFrameTimestamp = timestamp;
        }
        this.onRenderFrame.trigger();

        if (this.running && this.animationFrameId === undefined) {
            this.scheduleNextFrame();
        }
    }

    /** return the past game time in seconds */
    public getGameTime(): number {
        return Math.floor(this.ticksToSeconds(this.tickIndex));
    }

    /** return the past game time in ticks */
    public getGameTicks(): number {
        return this.tickIndex;
    }

    /** return the left game time in seconds */
    public getGameLeftTime(): number {
        let leftTicks = this.ticksTimeLimit - this.tickIndex;
        if (leftTicks < 0) leftTicks = 0;

        return Math.floor(this.ticksToSeconds(leftTicks));
    }

    /** return the left game time in seconds */
    public getGameLeftTimeString(): string {
        const leftSeconds = this.getGameLeftTime();
        const secondsStr = "0" + Math.floor(leftSeconds % 60);

        return Math.floor(leftSeconds / 60) + "-" + secondsStr.slice(-2);
    }

    /** convert a game-ticks-time to in game-seconds. Returns Float */
    public ticksToSeconds(ticks: number): number {
        return ticks * (this.TIME_PER_FRAME_MS / 1000);
    }

    /** calc the number ticks form game-time in seconds  */
    public secondsToTicks(seconds: number): number {
        return seconds * (1000 / this.TIME_PER_FRAME_MS);
    }

    /** return the maximum time in seconds to win the game  */
    public getGameTimeLimit(): number {
        return this.ticksTimeLimit;
    }

}
