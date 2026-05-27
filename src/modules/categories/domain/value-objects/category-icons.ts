/**
 * The 20 Antd icon names a Category can use, in the display order matching
 * Pencil A06c/A06d (Add/Edit Category modals).
 *
 * Editing this list is a schema-equivalent change. Update both this file AND
 * `campusgig-frontend/src/services/categories/icons.ts` together, otherwise
 * the drift-detection test (frontend D2) fails.
 */
export const ALLOWED_CATEGORY_ICONS = [
    'BookOutlined',
    'BgColorsOutlined',
    'DesktopOutlined',
    'EditOutlined',
    'CameraOutlined',
    'CalendarOutlined',
    'CustomerServiceOutlined',
    'TranslationOutlined',
    'ToolOutlined',
    'CodeOutlined',
    'ReadOutlined',
    'HighlightOutlined',
    'NotificationOutlined',
    'InboxOutlined',
    'CarOutlined',
    'GiftOutlined',
    'PrinterOutlined',
    'SmileOutlined',
    'VideoCameraOutlined',
    'AppstoreOutlined'
] as const

export type CategoryIcon = (typeof ALLOWED_CATEGORY_ICONS)[number]

export function isValidCategoryIcon(value: string): value is CategoryIcon {
    return (ALLOWED_CATEGORY_ICONS as readonly string[]).includes(value)
}
