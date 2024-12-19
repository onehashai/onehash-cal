const StepCard: React.FC<{ children: React.ReactNode }> = (props) => {
  return (
    <div className="sm:border-subtle bg-default mt-10  border p-4 sm:rounded-md sm:p-8 dark:bg-black">
      {props.children}
    </div>
  );
};

export { StepCard };
