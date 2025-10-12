export const loginModal = (() => {
	let show = $state(false);

	return {
		get show() {
			return show;
		},
		open() {
			show = true;
		},
		close() {
			show = false;
		}
	};
})();
