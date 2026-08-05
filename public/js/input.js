class InputHandler {
    constructor(canvas) {
        this.canvas = canvas;
        this.inputs = { up: false, down: false, left: false, right: false, moveAngle: null, isMoving: false };
        this.angle = 0;
        this.selectedSlot = 0;
        this.autoAttack = false;

        this.onAttack = null;
        this.onQuickHeal = null;

        this.initKeyboard();
        this.initTouch();
        this.initUI();
    }

    initKeyboard() {
        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            if (e.code === 'KeyW') this.inputs.up = true;
            if (e.code === 'KeyS') this.inputs.down = true;
            if (e.code === 'KeyA') this.inputs.left = true;
            if (e.code === 'KeyD') this.inputs.right = true;
            if (e.code === 'KeyQ') if (this.onQuickHeal) this.onQuickHeal();
            if (e.key >= '1' && e.key <= '6') {
                this.selectedSlot = parseInt(e.key) - 1;
                this.updateSlotUI();
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'KeyW') this.inputs.up = false;
            if (e.code === 'KeyS') this.inputs.down = false;
            if (e.code === 'KeyA') this.inputs.left = false;
            if (e.code === 'KeyD') this.inputs.right = false;
        });

        window.addEventListener('mousemove', (e) => {
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            this.angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        });

        window.addEventListener('mousedown', (e) => {
            if (e.button === 0 && this.onAttack) this.onAttack();
        });
    }

    initTouch() {
        const zone = document.getElementById('joystick-zone');
        const actionBtn = document.getElementById('action-btn');
        let touchStartX = 0, touchStartY = 0;

        zone.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            this.inputs.isMoving = true;
        });

        zone.addEventListener('touchmove', (e) => {
            if (!this.inputs.isMoving) return;
            const touch = e.touches[0];
            const dx = touch.clientX - touchStartX;
            const dy = touch.clientY - touchStartY;
            if (Math.hypot(dx, dy) > 10) {
                this.inputs.moveAngle = Math.atan2(dy, dx);
                this.angle = this.inputs.moveAngle; // Baktığı yönü de değiştir
            }
        });

        const endTouch = () => {
            this.inputs.isMoving = false;
            this.inputs.moveAngle = null;
        };

        zone.addEventListener('touchend', endTouch);
        zone.addEventListener('touchcancel', endTouch);

        actionBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.onAttack) this.onAttack();
        });
    }

    initUI() {
        document.querySelectorAll('.slot').forEach((el) => {
            el.addEventListener('click', () => {
                this.selectedSlot = parseInt(el.getAttribute('data-slot'));
                this.updateSlotUI();
            });
        });
    }

    updateSlotUI() {
        document.querySelectorAll('.slot').forEach((el, idx) => {
            el.classList.toggle('active', idx === this.selectedSlot);
        });
    }
}
