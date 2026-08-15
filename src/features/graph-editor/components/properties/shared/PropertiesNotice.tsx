interface PropertiesNoticeProps {
  title: string
  description: string
}

export function PropertiesNotice({
  title,
  description,
}: PropertiesNoticeProps) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
