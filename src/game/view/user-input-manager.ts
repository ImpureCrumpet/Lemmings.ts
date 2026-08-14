import { EventHandler } from '../utilities/event-handler';
import { Position2D } from '../utilities/position2d';

export class MouseMoveEventArguments extends Position2D {
    /** delta the mouse move Y */
    public deltaX = 0;
    /** delta the mouse move Y */
    public deltaY = 0;

    public button = false;

    /** position the user starts pressed the mouse */
    public mouseDownX = 0;
    /** position the user starts pressed the mouse */
    public mouseDownY = 0;

    constructor(x = 0, y = 0, deltaX = 0, deltaY = 0, button = false) {
        super(x, y);
        this.deltaX = deltaX;
        this.deltaY = deltaY;
        this.button = button;
    }
}

export class ZoomEventArguments extends Position2D {
    public deltaZoom: number;

    constructor(x = 0, y = 0, deltaZoom = 0) {
        super(x, y);
        this.deltaZoom = deltaZoom;
    }
}


/** handel the user events on the stage */
export class UserInputManager {

    private readonly eventController = new AbortController();

    private mouseDownX = 0;
    private mouseDownY = 0;

    private lastMouseX = 0;
    private lastMouseY = 0;

    private mouseButton = false;

    public onMouseMove = new EventHandler<MouseMoveEventArguments>();
    public onMouseUp = new EventHandler<Position2D>();
    public onMouseDown = new EventHandler<Position2D>();
    public onDoubleClick = new EventHandler<Position2D>();
    public onZoom = new EventHandler<ZoomEventArguments>();

    constructor(listenElement: HTMLElement) {

        const eventOptions = { signal: this.eventController.signal };
        const touchEventOptions = { ...eventOptions, passive: false };

        listenElement.addEventListener('mousemove', (e: MouseEvent) => {
            const relativePos = this.getRelativePosition(listenElement, e.clientX, e.clientY);
            this.handelMouseMove(relativePos);

            e.stopPropagation();
            e.preventDefault();

            return false;
        }, eventOptions);


        listenElement.addEventListener('touchmove', (e: TouchEvent) => {
            const touch = e.touches[0];
            if (!touch) {
                return;
            }
            const relativePos = this.getRelativePosition(listenElement, touch.clientX, touch.clientY);
            this.handelMouseMove(relativePos);

            e.stopPropagation();
            e.preventDefault();

            return false;
        }, touchEventOptions);

        listenElement.addEventListener('touchstart', (e: TouchEvent) => {
            const touch = e.touches[0];
            if (!touch) {
                return;
            }
            const relativePos = this.getRelativePosition(listenElement, touch.clientX, touch.clientY);
            this.handelMouseDown(relativePos);

            e.stopPropagation();
            e.preventDefault();

            return false;
        }, touchEventOptions);

        listenElement.addEventListener('mousedown', (e: MouseEvent) => {
            const relativePos = this.getRelativePosition(listenElement, e.clientX, e.clientY);
            this.handelMouseDown(relativePos);

            e.stopPropagation();
            e.preventDefault();

            return false;
        }, eventOptions);

        listenElement.addEventListener('mouseup', (e: MouseEvent) => {
            const relativePos = this.getRelativePosition(listenElement, e.clientX, e.clientY);
            this.handelMouseUp(relativePos);

            e.stopPropagation();
            e.preventDefault();

            return false;
        }, eventOptions);

        listenElement.addEventListener('mouseleave', () => {
            this.handelMouseClear();
        }, eventOptions);

        listenElement.addEventListener('touchend', (e: TouchEvent) => {
            const touch = e.changedTouches[0];
            if (!touch) {
                this.handelMouseClear();
                return;
            }
            const relativePos = this.getRelativePosition(listenElement, touch.clientX, touch.clientY);
            this.handelMouseUp(relativePos);

            return false;
        }, touchEventOptions);

        listenElement.addEventListener('touchcancel', () => {
            this.handelMouseClear();
            return false;
        }, eventOptions);


        listenElement.addEventListener('dblclick', (e: MouseEvent) => {
            const relativePos = this.getRelativePosition(listenElement, e.clientX, e.clientY);
            this.handleMouseDoubleClick(relativePos);

            e.stopPropagation();
            e.preventDefault();

            return false;
        }, eventOptions);



        listenElement.addEventListener('wheel', (e: WheelEvent) => {
            const relativePos = this.getRelativePosition(listenElement, e.clientX, e.clientY);
            this.handelWheel(relativePos, e.deltaY);

            e.stopPropagation();
            e.preventDefault();

            return false;
        }, { ...touchEventOptions });

    }



    private getRelativePosition(element: HTMLElement, clientX: number, clientY: number): Position2D {

        const rect = element.getBoundingClientRect();

        if (element instanceof HTMLCanvasElement) {
            const scaleX = element.width / rect.width;
            const scaleY = element.height / rect.height;
            return new Position2D(
                (clientX - rect.left) * scaleX,
                (clientY - rect.top) * scaleY,
            );
        }

        return new Position2D(clientX - rect.left, clientY - rect.top);
    }

    public dispose(): void {
        this.eventController.abort();
        this.onMouseMove.dispose();
        this.onMouseUp.dispose();
        this.onMouseDown.dispose();
        this.onDoubleClick.dispose();
        this.onZoom.dispose();
    }


    private handelMouseMove(position: Position2D) {

        //- Move Point of View
        if (this.mouseButton) {

            const deltaX = (this.lastMouseX - position.x);
            const deltaY = (this.lastMouseY - position.y);

            //- save start of Mousedown
            this.lastMouseX = position.x;
            this.lastMouseY = position.y;

            const mouseDragArguments = new MouseMoveEventArguments(position.x, position.y, deltaX, deltaY, true)
            mouseDragArguments.mouseDownX = this.mouseDownX;
            mouseDragArguments.mouseDownY = this.mouseDownY;

            /// raise event
            this.onMouseMove.trigger(mouseDragArguments);
        }
        else {
            /// raise event
            this.onMouseMove.trigger(new MouseMoveEventArguments(position.x, position.y, 0, 0, false));
        }
    }

    private handelMouseDown(position: Position2D) {
        //- save start of Mousedown
        this.mouseButton = true;
        this.mouseDownX = position.x;
        this.mouseDownY = position.y;
        this.lastMouseX = position.x;
        this.lastMouseY = position.y;

        /// create new event handler
        this.onMouseDown.trigger(position);
    }

    private handleMouseDoubleClick(position: Position2D) {
        this.onDoubleClick.trigger(position);
    }

    private handelMouseClear() {
        this.mouseButton = false;
        this.mouseDownX = 0;
        this.mouseDownY = 0;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
    }

    private handelMouseUp(position: Position2D) {
        this.handelMouseClear();

        this.onMouseUp.trigger(new Position2D(position.x, position.y));
    }

    /** Zoom view 
     * todo: zoom to mouse pointer */
    private handelWheel(position: Position2D, deltaY: number) {

        if (deltaY < 0) {
            this.onZoom.trigger(new ZoomEventArguments(position.x, position.y, 1));
        }
        if (deltaY > 0) {
            this.onZoom.trigger(new ZoomEventArguments(position.x, position.y, -1));
        }
    }


}
