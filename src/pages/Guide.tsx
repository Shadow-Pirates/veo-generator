import { useMemo, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

type GuideTab = {
  key: string
  title: string
}

const tabs: GuideTab[] = [
  { key: 'overview', title: '开始使用' },
  { key: 'video', title: '视频生成' },
  { key: 'image', title: '图片生成' },
  { key: 'tasks', title: '任务管理' },
  { key: 'history', title: '历史记录' },
  { key: 'favorites', title: '我的收藏' },
  { key: 'templates', title: '模板管理' },
  { key: 'settings', title: '设置' },
]

const mdModules = import.meta.glob<string>('../guides/*.md', { as: 'raw', eager: true })

const mdComponents: Components = {
  h1: (props) => <h1 className="text-xl font-bold mt-2" {...props} />,
  h2: (props) => <h2 className="text-lg font-semibold mt-4" {...props} />,
  h3: (props) => <h3 className="text-base font-semibold mt-4" {...props} />,
  p: (props) => <p className="text-sm leading-6" {...props} />,
  ul: (props) => <ul className="list-disc pl-5 space-y-1 text-sm" {...props} />,
  ol: (props) => <ol className="list-decimal pl-5 space-y-1 text-sm" {...props} />,
  li: (props) => <li className="text-sm" {...props} />,
  a: ({ href, ...rest }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline underline-offset-2"
      {...rest}
    />
  ),
  code: ({ className, ...rest }) => (
    <code className={(className || '') + ' rounded bg-muted px-1 py-0.5 text-xs'} {...rest} />
  ),
  pre: (props) => <pre className="rounded bg-muted p-3 overflow-auto text-xs" {...props} />,
  img: ({ src = '', alt = '', ...rest }) => (
    <img src={resolveGuideAsset(String(src))} alt={alt} className="rounded-md border bg-background" {...rest} />
  ),
  table: (props) => <table className="w-full text-sm border" {...props} />,
  th: (props) => <th className="border px-2 py-1 text-left bg-muted" {...props} />,
  td: (props) => <td className="border px-2 py-1" {...props} />,
}

function resolveGuideAsset(src: string) {
  if (!src) return src
  if (/^(https?:)?\/\//i.test(src)) return src
  if (src.startsWith('data:')) return src

  const cleaned = src.replace(/^\.\//, '')
  try {
    return new URL(`../guides/${cleaned}`, import.meta.url).toString()
  } catch {
    return src
  }
}

export default function Guide() {
  const [active, setActive] = useState<string>('overview')

  const content = useMemo(() => {
    const key = `../guides/${active}.md`
    return String((mdModules as any)[key] || '')
  }, [active])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">使用指南</h1>
          <div className="text-sm text-muted-foreground mt-1">按功能查看详细说明与常见问题</div>
        </div>
      </div>

      <div className="border rounded-lg bg-background">
        <div className="border-b px-3 py-2">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((t) => {
              const isActive = t.key === active
              return (
                <button
                  key={t.key}
                  onClick={() => setActive(t.key)}
                  className={
                    'px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ' +
                    (isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')
                  }
                >
                  {t.title}
                </button>
              )
            })}
          </div>
        </div>

        <div className="p-4">
          <div className="max-w-3xl space-y-3">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={mdComponents}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}
