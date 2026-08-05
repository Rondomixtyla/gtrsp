class InputHandler {
    constructor(canvas) {
        this.canvas = canvas;
        this.inputs = { up: false, down: false, left: false, right: false };
        this.angle = 0;
        this.selectedSlot = 0;
        this.autoAttack = false;

        this.onAttack = null;
        this.onQuickHeal = null;

        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0 && this.onAttack) this.onAttack();
        });
    }

    handleKeyDown(e) {
        if (e.repeat) return;

        switch (e.code) {
            case 'KeyW': this.inputs.up = true; break;
            case 'KeyS': this.inputs.down = true; break;
            case 'KeyA': this.inputs.left = true; break;
            case 'KeyD': this.inputs.right = true; break;
            case 'KeyE': 
                this.autoAttack = !this.autoAttack; 
                break;
            case 'KeyQ': 
                if (this.onQuickHeal) this.onQuickHeal(); 
                break;
        }

        if (e.key >= '1' && e.key <= '6') {
            this.selectedSlot = parseInt(e.key) - 1;
            this.updateSlotUI();
        }
    }

    handleKeyUp(e) {
        switch (e.code) {
            case 'KeyW': this.inputs.up = false; break;
            case 'KeyS': this.inputs.down = false; break;
            case 'KeyA': this.inputs.left = false; break;
            case 'KeyD': this.inputs.right = false; break;
        }
    }

    handleMouseMove(e) {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        this.angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    }

    updateSlotUI() {
        document.querySelectorAll('.slot').forEach((el, idx) => {
            el.classList.toggle('active', idx === this.selectedSlot);
        });
    }
}
