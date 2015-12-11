all: redirectcleaner.xpi

clean:
	rm -f redirectcleaner.xpi

redirectcleaner.xpi: src/
	cd src/ && 7za a ../redirectcleaner.xpi ./ -tzip -mx=9 && cd ..
