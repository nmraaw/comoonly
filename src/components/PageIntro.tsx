type PageIntroProps = { title: string; description: string }

export default function PageIntro({ title, description }: PageIntroProps) {
  return <header className="page-intro"><h1>{title}</h1><p>{description}</p></header>
}
