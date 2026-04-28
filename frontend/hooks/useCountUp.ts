"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionValue, useSpring, useInView, type SpringOptions } from "framer-motion";

interface UseCountUpOptions {
	// Target angka final.
	target: number;
	// Mulai animasi ketika elemen masuk viewport (default: true).
	triggerOnView?: boolean;
	// Override spring config; default tuned untuk ~800ms ease-out feel.
	spring?: SpringOptions;
	// Bulatkan ke integer di output (default: true — angka rupiah selalu integer).
	round?: boolean;
}

interface UseCountUpResult {
	value: number;
	ref: React.RefObject<HTMLElement>;
}

// Hand-rolled count-up hook backed by Framer Motion springs.
// Trigger animasi saat elemen pertama kali masuk viewport, lalu tetap di nilai final.
export function useCountUp({
	target,
	triggerOnView = true,
	spring,
	round = true,
}: UseCountUpOptions): UseCountUpResult {
	const ref = useRef<HTMLElement>(null);
	const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
	const motionValue = useMotionValue(0);
	const springValue = useSpring(motionValue, spring ?? { duration: 0.8, bounce: 0 });
	const [display, setDisplay] = useState(0);

	useEffect(() => {
		if (triggerOnView && !inView) return;
		motionValue.set(target);
	}, [target, triggerOnView, inView, motionValue]);

	useEffect(() => {
		const unsubscribe = springValue.on("change", (latest) => {
			setDisplay(round ? Math.round(latest) : latest);
		});
		return () => unsubscribe();
	}, [springValue, round]);

	return { value: display, ref };
}
