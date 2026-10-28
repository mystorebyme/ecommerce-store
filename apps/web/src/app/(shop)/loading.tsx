// Purpose: Instant feedback — route change par turant skeleton (CLS zero, spinner nahi)
//
// Next isse suspense boundary ki tarah use karta hai: page ka data server par ban raha ho
// to bhi user ko 0ms par layout dikh jaata hai.

export default function ShopLoading() {
  return (
    <main className="container" aria-busy="true" aria-live="polite">
      <section className="hero">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-text" />
        <div className="skeleton skeleton-text short" />
      </section>
      <div className="section-head">
        <div className="skeleton skeleton-heading" />
      </div>
      <div className="grid">
        {[0, 1, 2, 3].map((key) => (
          <div className="card" key={key}>
            <div className="skeleton skeleton-art" />
            <div className="card-body">
              <div className="skeleton skeleton-heading" />
              <div className="skeleton skeleton-text short" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
