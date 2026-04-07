export class UIManager {
    private scoreElement: HTMLElement;
    private distanceElement: HTMLElement;

    constructor() {
        this.scoreElement = document.getElementById('score')!;
        this.distanceElement = document.getElementById('distanceValue')!;
    }

    public updateScore(score: number): void {
        this.scoreElement.textContent = score.toString();
    }

    public updateDistance(distance: number | null): void {
        if (distance !== null) {
            this.distanceElement.textContent = Math.round(distance).toString();
        } else {
            this.distanceElement.textContent = '---';
        }
    }

    public showMessage(text: string, duration: number = 700): void {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'reload-hint';
        msgDiv.textContent = text;
        document.body.appendChild(msgDiv);
        setTimeout(() => msgDiv.remove(), duration);
    }
}
