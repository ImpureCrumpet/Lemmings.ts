import { EventHandler } from '../utilities/event-handler';
import { Position2D } from '../utilities/position2d';

const DRAG_THRESHOLD_PX = 5;

export class PointerMoveEventArguments extends Position2D {
    public deltaX = 0;
    public deltaY = 0;
    public button = false;
    public pointerType = 'mouse';
    public pointerDownX = 0;
    public pointerDownY = 0;

    public constructor(
        x = 0,
        y = 0,
        deltaX = 0,
        deltaY = 0,
        button = false,
        pointerType = 'mouse',
    ) {
        super(x, y);
        this.deltaX = deltaX;
        this.deltaY = deltaY;
        this.button = button;
        this.pointerType = pointerType;
    }
}

/** Handles mouse, touch, and pen through one captured Pointer Events path. */
export class UserInputManager {
    private readonly eventController = new AbortController();
    private activePointerId: number | undefined;
    private pointerDownX = 0;
    private pointerDownY = 0;
    private pointerDownClientX = 0;
    private pointerDownClientY = 0;
    private lastPointerX = 0;
    private lastPointerY = 0;
    private dragged = false;

    public onMouseMove = new EventHandler<PointerMoveEventArguments>();
    public onMouseUp = new EventHandler<Position2D>();
    public onMouseDown = new EventHandler<Position2D>();
    public onTap = new EventHandler<Position2D>();
    public onPointerCancel = new EventHandler<void>();
    public onDoubleClick = new EventHandler<Position2D>();

    public constructor(private readonly listenElement: HTMLElement) {
        const eventOptions = { signal: this.eventController.signal };
        const activeEventOptions = { ...eventOptions, passive: false };

        listenElement.addEventListener('pointerdown', (event: PointerEvent) => {
            if (!event.isPrimary || this.activePointerId !== undefined || event.button !== 0) {
                return;
            }

            const position = this.getRelativePosition(event.clientX, event.clientY);
            this.activePointerId = event.pointerId;
            this.pointerDownX = position.x;
            this.pointerDownY = position.y;
            this.pointerDownClientX = event.clientX;
            this.pointerDownClientY = event.clientY;
            this.lastPointerX = position.x;
            this.lastPointerY = position.y;
            this.dragged = false;

            try {
                listenElement.setPointerCapture(event.pointerId);
            } catch {
                // Capture can fail if the pointer ended before this handler ran.
            }

            listenElement.focus({ preventScroll: true });
            this.onMouseDown.trigger(position);
            event.preventDefault();
        }, activeEventOptions);

        listenElement.addEventListener('pointermove', (event: PointerEvent) => {
            if (!event.isPrimary) {
                return;
            }

            const position = this.getRelativePosition(event.clientX, event.clientY);
            if (this.activePointerId === undefined) {
                this.onMouseMove.trigger(new PointerMoveEventArguments(
                    position.x,
                    position.y,
                    0,
                    0,
                    false,
                    event.pointerType,
                ));
                return;
            }
            if (event.pointerId !== this.activePointerId) {
                return;
            }

            const movedX = event.clientX - this.pointerDownClientX;
            const movedY = event.clientY - this.pointerDownClientY;
            if ((movedX * movedX) + (movedY * movedY) >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
                this.dragged = true;
            }

            const move = new PointerMoveEventArguments(
                position.x,
                position.y,
                this.lastPointerX - position.x,
                this.lastPointerY - position.y,
                this.dragged,
                event.pointerType,
            );
            move.pointerDownX = this.pointerDownX;
            move.pointerDownY = this.pointerDownY;
            this.lastPointerX = position.x;
            this.lastPointerY = position.y;
            this.onMouseMove.trigger(move);
            event.preventDefault();
        }, activeEventOptions);

        listenElement.addEventListener('pointerup', (event: PointerEvent) => {
            if (event.pointerId !== this.activePointerId) {
                return;
            }

            const position = this.getRelativePosition(event.clientX, event.clientY);
            const wasDragged = this.dragged;
            this.clearActivePointer(event.pointerId);
            this.onMouseUp.trigger(position);
            if (!wasDragged) {
                this.onTap.trigger(position);
            }
            event.preventDefault();
        }, activeEventOptions);

        const cancelPointer = (event: PointerEvent) => {
            if (event.pointerId !== this.activePointerId) {
                return;
            }
            this.clearActivePointer(event.pointerId);
            this.onPointerCancel.trigger();
        };
        listenElement.addEventListener('pointercancel', cancelPointer, eventOptions);
        listenElement.addEventListener('lostpointercapture', cancelPointer, eventOptions);

        listenElement.addEventListener('dblclick', (event: MouseEvent) => {
            const position = this.getRelativePosition(event.clientX, event.clientY);
            this.onDoubleClick.trigger(position);
            event.preventDefault();
        }, activeEventOptions);

        listenElement.addEventListener('wheel', (event: WheelEvent) => {
            // Browsers expose trackpad pinch as a modifier-wheel gesture. Block
            // that gesture over the canvas, but leave ordinary wheel scrolling
            // and keyboard browser zoom (Cmd/Ctrl + or -) untouched.
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
            }
        }, activeEventOptions);

        const preventGestureZoom = (event: Event) => event.preventDefault();
        listenElement.addEventListener('gesturestart', preventGestureZoom, activeEventOptions);
        listenElement.addEventListener('gesturechange', preventGestureZoom, activeEventOptions);
    }

    private getRelativePosition(clientX: number, clientY: number): Position2D {
        const rect = this.listenElement.getBoundingClientRect();
        const isCanvas = typeof HTMLCanvasElement !== 'undefined'
            && this.listenElement instanceof HTMLCanvasElement;

        if (isCanvas) {
            const scaleX = this.listenElement.width / rect.width;
            const scaleY = this.listenElement.height / rect.height;
            return new Position2D(
                (clientX - rect.left) * scaleX,
                (clientY - rect.top) * scaleY,
            );
        }

        return new Position2D(clientX - rect.left, clientY - rect.top);
    }

    private clearActivePointer(pointerId: number): void {
        this.activePointerId = undefined;
        this.pointerDownX = 0;
        this.pointerDownY = 0;
        this.lastPointerX = 0;
        this.lastPointerY = 0;
        this.dragged = false;

        try {
            if (this.listenElement.hasPointerCapture(pointerId)) {
                this.listenElement.releasePointerCapture(pointerId);
            }
        } catch {
            // The browser may already have released capture.
        }
    }

    public dispose(): void {
        if (this.activePointerId !== undefined) {
            this.clearActivePointer(this.activePointerId);
        }
        this.eventController.abort();
        this.onMouseMove.dispose();
        this.onMouseUp.dispose();
        this.onMouseDown.dispose();
        this.onTap.dispose();
        this.onPointerCancel.dispose();
        this.onDoubleClick.dispose();
    }
}
