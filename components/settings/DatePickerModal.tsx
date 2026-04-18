"use client";

import { useState } from "react";
import Calendar from "react-calendar";
import { toDateString } from "../../lib/format";
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

	const handleChange = (value: CalendarValue) => {
		const nextValue = Array.isArray(value) ? value[0] : value;
		setDraftDate(nextValue ?? null);
	};

	const handleApply = () => {
		if (!draftDate) return;
		onApply(toDateString(draftDate));
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
			<div className="retro-panel max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-[28px] p-5 sm:max-w-xl">
				<div className="mb-4 text-center">
					<div className="mx-auto max-w-md">
						<p className="theme-copy text-sm">
							기준일 하루를 고르면 같은 요일이 2주 간격 정기휴무로 자동 계산됩니다.
						</p>
					</div>
				</div>

				<div
					className="retro-calendar mt-4 rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-3 md:p-4"
					style={{ marginBottom: "24px" }}
				>
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

				<div className="mx-auto grid w-full max-w-[420px] gap-4 sm:grid-cols-2">
					<button
						type="button"
						onClick={handleApply}
						disabled={!draftDate}
						className="retro-button-solid ui-action-fit min-h-[48px] px-4 py-3 text-sm font-semibold disabled:opacity-60"
						style={{ marginBottom: "12px" }}
					>
						기준일 적용
					</button>
					<button
						type="button"
						onClick={onClose}
						className="retro-button ui-action-fit min-h-[48px] px-4 py-3 text-sm font-semibold"
						style={{ marginBottom: "12px" }}
					>
						닫기
					</button>
				</div>
			</div>
		</div>
	);
}
