export default function RedirectLoader() {
  return (
    <div className="wrapper">
      <div className="blue ball" />
      <div className="red ball" />
      <div className="yellow ball" />
      <div className="green ball" />
      <style jsx>{`
        .wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 200px;
        }

        .ball {
          --size: 16px;
          width: var(--size);
          height: var(--size);
          border-radius: 11px;
          margin: 0 10px;

          animation: 2s bounce ease infinite;
        }

        .blue {
          background-color: #f1352c;
        }

        .red {
          background-color: #007ee5;
          animation-delay: 0.25s;
        }

        .yellow {
          background-color: #008c44;
          animation-delay: 0.5s;
        }

        .green {
          background-color: #f9a400;
          animation-delay: 0.75s;
        }

        @keyframes bounce {
          50% {
            transform: translateY(25px);
          }
        }
      `}</style>
    </div>
  );
}
