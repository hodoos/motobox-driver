"use client";

import { useState } from "react";
import Calendar from "react-calendar";
import { getKoreanDayLabel, toDateString } from "../../lib/format";
import { isBiweeklyOffDate } from "../../lib/offday";

type CalendarValue = Date | null | [Date | null, Date | null];

type Props = {
	anchorDate: string;
	biweeklyOffDays: number[];
	onClose: () => void;
	onApply: (dateKey: string) => void;
};

function parseDateKey(dateKey: string) {
	if (!dateKey) return null;

	const parsed = new Date(`${dateKey}T12:00:00`);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function DatePickerModal({
	anchorDate,
	biweeklyOffDays,
	onClose,
	onApply,
}: Props) {
	const [draftDate, setDraftDate] = useState<Date | null>(parseDateKey(anchorDate));

	const previewAnchorDate = draftDate ? toDateString(draftDate) : anchorDate;
	const previewOffDays = draftDate ? [draftDate.getDay()] : biweeklyOffDays;
	const previewLabel = draftDate
		? `${previewAnchorDate} (${getKoreanDayLabel(draftDate.getDay())}요일)`
		: anchorDate && biweeklyOffDays.length > 0
			? `${anchorDate} (${getKoreanDayLabel(biweeklyOffDays[0])}요일)`
			: "선택된 기준일 없음";

	const handleChange = (value: CalendarValue) => {
		const nextValue = Array.isArray(value) ? value[0] : value;
		setDraftDate(nextValue ?? null);
	};

	const handleApply = () => {
		if (!draftDate) return;
		onApply(toDateString(draftDate));
	};

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:p-4">
			<div className="retro-panel max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:max-w-xl sm:rounded-[28px] sm:p-5">
				<div className="mb-4 text-center">
					<div className="mx-auto max-w-md">
						<h3 className="retro-title theme-heading text-base leading-relaxed sm:text-lg">
							BIWEEKLY DATE PICKER
						</h3>
						<p className="theme-copy mt-2 text-sm">
							기준일 하루를 고르면 같은 요일이 2주 간격 정기휴무로 자동 계산됩니다.
						</p>
					</div>
				</div>

				<div className="retro-card rounded-[24px] px-4 py-3 text-center">
					<p className="theme-label text-xs font-semibold">현재 선택</p>
					<p className="theme-heading mt-2 text-sm">{previewLabel}</p>
				</div>

				<div className="retro-calendar mt-4 rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-3 md:p-4">
					<Calendar
						calendarType="gregory"
						locale="ko-KR"
						next2Label={null}
						prev2Label={null}
						formatDay={(_, date) => String(date.getDate())}
						onChange={handleChange}
						value={draftDate}
						tileClassName={({ date, view }) => {
							if (view !== "month") {
								return undefined;
							}

							const dateKey = toDateString(date);

							if (previewAnchorDate && dateKey === previewAnchorDate) {
								return "retro-calendar__tile retro-calendar__tile--anchor";
							}

							if (
								previewAnchorDate &&
								previewOffDays.length > 0 &&
								isBiweeklyOffDate(date, previewOffDays, previewAnchorDate)
							) {
								return "retro-calendar__tile retro-calendar__tile--biweekly";
							}

							return "retro-calendar__tile";
						}}
					/>
				</div>

				<div className="theme-copy mx-auto mt-4 grid max-w-[520px] gap-2 text-center text-xs sm:grid-cols-3">
					<div className="theme-note-box rounded-2xl px-3 py-2">
						밝은 회색: 기준일
					</div>
					<div className="theme-note-box rounded-2xl px-3 py-2">
						옅은 회색: 2주 반복 예정일
					</div>
					<div className="theme-note-box rounded-2xl px-3 py-2">
						날짜를 눌러 기준일 초안을 변경
					</div>
				</div>

				<div className="mx-auto mt-5 grid w-full max-w-[420px] gap-4 sm:grid-cols-2">
					<button
						type="button"
						onClick={onClose}
						className="retro-button ui-action-fit min-h-[48px] px-4 py-3 text-sm font-semibold"
					>
						닫기
					</button>
					<button
						type="button"
						onClick={handleApply}
						disabled={!draftDate}
						className="retro-button-solid ui-action-fit min-h-[48px] px-4 py-3 text-sm font-semibold disabled:opacity-60"
					>
						기준일 적용
					</button>
				</div>
			</div>
		</div>
	);
}
