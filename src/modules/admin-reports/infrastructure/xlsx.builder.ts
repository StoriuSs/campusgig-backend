import { Workbook } from 'exceljs'

import { ReportTable } from '../domain/report.types'

// Renders a resolved ReportTable into .xlsx bytes. Indigo header band + frozen
// header row to match the platform's look. Buffer (not streaming) is fine at
// v1 scale; swap to the streaming writer if exports ever grow large.
export async function buildWorkbookBuffer(table: ReportTable): Promise<Buffer> {
    const wb = new Workbook()
    wb.creator = 'CampusGig'
    const ws = wb.addWorksheet(table.sheetName)

    ws.columns = table.columns.map((c) => ({ header: c.header, key: c.key, width: c.width }))
    ws.addRows(table.rows)

    const header = ws.getRow(1)
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B5BF5' } }
    header.alignment = { vertical: 'middle' }
    header.height = 20
    ws.views = [{ state: 'frozen', ySplit: 1 }]

    const buffer = await wb.xlsx.writeBuffer()
    return Buffer.from(buffer)
}
