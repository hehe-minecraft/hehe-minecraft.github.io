function setIntervalTimeout(callback, timeout, interval)
{
	let intervalID = setInterval(callback, interval);
	setTimeout(function() {
		clearInterval(intervalID);
	}, timeout);
	return intervalID;
};