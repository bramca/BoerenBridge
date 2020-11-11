args = commandArgs(trailingOnly=TRUE)

dat_csv = read.csv(args[1], sep=';')
windows()
plot(dat_csv$rank, dat_csv$risk_taking, type="p", xlab="rank", ylab="risk_taking")
## dev.off()
message("Press Return To Continue")
invisible(readLines("stdin", n=1))
## dat_csv

agg = aggregate(list(Risk = dat_csv$risk_taking, Score = dat_csv$score), by=list(Rank = dat_csv$rank), FUN=function(x) c(mean=mean(x), sd=sd(x), max=max(x), min=min(x)))

agg
