class NoopSpectorCaptureSignal {
	add() {}
}

class Spector {
	onCapture = new NoopSpectorCaptureSignal();

	captureCanvas() {}

	captureNextFrame() {}

	getFps() {
		return 0;
	}

	log(message: string) {
		return message;
	}

	startCapture() {}

	stopCapture() {
		return null;
	}

	getResultUI() {
		return {
			display() {},
		};
	}
}

const phaser3spectorjs = { Spector };

export { Spector };
export default phaser3spectorjs;