export function setIntervalTimeout(callback: () => void, timeout: number, interval: number): number
{
	const intervalID = setInterval(callback, interval);
	setTimeout(function() {
		clearInterval(intervalID);
	}, timeout);
	return intervalID;
};